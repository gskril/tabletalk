import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { env, backgroundTasks } from "./runtime-mock.mjs";
import { publicCatalog } from "../lib/catalog-cache.ts";
import { POST as checkCatalog } from "../app/api/flynet/discovery/route.ts";
import { authDiagnostic } from "../lib/auth-diagnostics.ts";
import { memberPassport } from "../lib/passport.ts";
import { cookieJar } from "./headers-mock.mjs";
import { GET as start } from "../app/api/auth/blackbird/start/route.ts";
import { GET as callback } from "../app/api/auth/blackbird/callback/route.ts";
import { POST as sync } from "../app/api/flynet/sync/route.ts";
import { POST as action } from "../app/api/action/route.ts";
import { GET as state } from "../app/api/state/route.ts";
import { makeSession, currentUser } from "../lib/auth.ts";
import { POST as demoSignup } from "../app/api/auth/demo/route.ts";
import { requestHeaders } from "./headers-mock.mjs";
import { FlynetMemberClient } from "@flynetdev/core";
import {
  syncVisits,
  syncDiscovery,
  upsertVenue,
  isNYC,
  encryptToken,
  decryptToken,
} from "../lib/flynet.ts";
const sql = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle")
  .filter((x) => x.endsWith(".sql"))
  .sort())
  sql.exec(readFileSync("drizzle/" + file, "utf8"));
function statement(query) {
  let args = [];
  return {
    bind(...values) {
      args = values;
      return this;
    },
    async first() {
      return sql.prepare(query).get(...args) || null;
    },
    async all() {
      return { results: sql.prepare(query).all(...args) };
    },
    async run() {
      const r = sql.prepare(query).run(...args);
      return { success: true, meta: { changes: r.changes } };
    },
  };
}
env.DB = {
  prepare: statement,
  batch: async (stmts) => {
    sql.exec("BEGIN");
    try {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      sql.exec("COMMIT");
      return out;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  },
};
Object.assign(env, {
  FLYNET_CLIENT_ID: "test-client",
  FLYNET_CLIENT_SECRET: "test-secret",
  FLYNET_REDIRECT_URI: "https://tabletalk.test/api/auth/blackbird/callback",
  FLYNET_AUDIENCE: "test-audience",
  TOKEN_ENCRYPTION_KEY: "only-for-testing-32-character-encryption-key",
  FLYNET_API_KEY: "fly_test_fixture",
});
const at = "2026-09-01T00:00:00Z",
  id = "11111111-1111-4111-8111-111111111111",
  locationId = "22222222-2222-4222-8222-222222222222";
const location = {
  id: locationId,
  object: "location",
  name: "Test NYC Table",
  restaurant: {
    id: "33333333-3333-4333-8333-333333333333",
    object: "restaurant",
    name: "Test brand",
    cuisine: ["Italian"],
    cohort: null,
    tags: [],
    created_at: at,
    updated_at: at,
  },
  neighborhood: {
    id: "44444444-4444-4444-8444-444444444444",
    object: "neighborhood",
    name: "Nolita",
    region: "NYC",
  },
  address: {
    street: "1 Test St",
    city: "New York",
    state: "NY",
    zipcode: "10012",
    country: "US",
  },
  time_zone: "America/New_York",
  payments_enabled: false,
  is_club: false,
  reservations_enabled: false,
  created_at: at,
  updated_at: at,
};
const pagination = {
  total_count: 1,
  total_pages: 1,
  current_page: 0,
  next_page: null,
  page_size: 50,
};
let upstreamOverride;
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  calls.push(req.clone());
  const p = new URL(req.url).pathname;
  if (p.endsWith("/oauth/token")) {
    assert.equal(req.method, "POST");
    assert.match(req.headers.get("User-Agent") || "", /^Tabletalk\/1\.0 /);
    assert.equal(req.headers.get("Content-Type"), "application/x-www-form-urlencoded");
    assert.equal(req.redirect, "manual");
    const form = await req.formData();
    assert.equal(form.get("client_secret"), "test-secret");
    assert.ok(String(form.get("code_verifier")).length >= 43);
    return Response.json({
      access_token: "valid-provider-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "not-retained",
    });
  }
  assert.equal(
    req.headers.get("Authorization"),
    p.endsWith("/locations") ? null : "Bearer valid-provider-token",
  );
  if (upstreamOverride) return upstreamOverride(req);
  if (p.endsWith("/users/me"))
    return Response.json({
      id,
      object: "user",
      first_name: "Real",
      last_name: "Member",
      email: "private@example.com",
      account_status: "ok",
      created_at: at,
      updated_at: at,
    });
  if (p.endsWith("/users/me/check_ins"))
    return Response.json({
      check_ins: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          object: "check_in",
          location,
          blackbird_pay_enabled: false,
          created_at: at,
        },
      ],
      pagination,
    });
  if (p.endsWith("/locations")) {
    assert.equal(req.headers.get("X-API-Key"), "fly_test_fixture");
    return Response.json({
      locations: [
        location,
        {
          ...location,
          id: "66666666-6666-4666-8666-666666666666",
          address: { ...location.address, city: "San Francisco", state: "CA" },
        },
      ],
      pagination,
    });
  }
  throw new Error("Unexpected upstream request " + req.url);
};
test("PKCE, browser state, exchange, encrypted token, private check-in import and replay defense", async () => {
  const r = await start(
    new Request("https://tabletalk.test/api/auth/blackbird/start"),
  );
  assert.equal(r.status, 302);
  const url = new URL(r.headers.get("location"));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("scope"),
    "read:profile read:user_checkins",
  );
  assert.equal(url.searchParams.get("audience"), "test-audience");
  assert.ok(url.searchParams.get("code_challenge"));
  const oauthState = url.searchParams.get("state");
  cookieJar.set("tt_oauth", oauthState);
  const forged = await callback(
    new Request(
      "https://tabletalk.test/api/auth/blackbird/callback?state=wrong&code=fake",
    ),
  );
  assert.match(forged.headers.get("location"), /auth_error/);
  assert.equal(calls.length, 0);
  const cbUrl =
    "https://tabletalk.test/api/auth/blackbird/callback?state=" +
    oauthState +
    "&code=one-use-code";
  const good = await callback(new Request(cbUrl));
  assert.match(good.headers.get("location"), /connected=1/);
  const session = good.headers
    .getSetCookie()
    .find((x) => x.startsWith("tt_session="))
    .split(";")[0]
    .split("=")[1];
  cookieJar.set("tt_session", session);
  const stored = sql.prepare("SELECT * FROM sessions").get();
  assert.notEqual(stored.token, "valid-provider-token");
  assert.equal(await decryptToken(stored.token), "valid-provider-token");
  assert.ok(!JSON.stringify(stored).includes("not-retained"));
  assert.ok(
    !JSON.stringify(sql.prepare("SELECT * FROM profiles").get()).includes(
      "private@example.com",
    ),
  );
  const before = calls.length;
  const replay = await callback(new Request(cbUrl));
  assert.match(replay.headers.get("location"), /auth_error/);
  assert.equal(calls.length, before);
  // Landing after sign-in starts private sync without an explicit import action.
  const landing = await (await state()).json();
  assert.equal(landing.passport.status, "syncing");
  await Promise.all(backgroundTasks.splice(0));
  const ready = await (await state()).json();
  assert.equal(ready.passport.status, "ready");
  assert.equal(ready.visits.length, 1);
  assert.ok(!JSON.stringify(ready).includes("valid-provider-token"));
  const imported = await sync(
    new Request("https://tabletalk.test/api/flynet/sync", {
      method: "POST",
      headers: { origin: "https://tabletalk.test" },
    }),
  );
  assert.equal(imported.status, 200);
  assert.equal((await imported.json()).count, 1);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM visits").get().n, 1);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reviews").get().n, 0);
  const again = await sync(
    new Request("https://tabletalk.test/api/flynet/sync", {
      method: "POST",
      headers: { origin: "https://tabletalk.test" },
    }),
  );
  assert.equal(again.status, 200);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM visits").get().n, 1);
  sql.prepare("UPDATE sessions SET token_expires_at=0").run();
  assert.equal(
    (
      await sync(
        new Request("https://tabletalk.test/api/flynet/sync", {
          method: "POST",
          headers: { origin: "https://tabletalk.test" },
        }),
      )
    ).status,
    401,
  );
});
test("discovery uses API key and excludes non-NYC locations", async () => {
  const result = await syncDiscovery();
  assert.equal(result.count, 1);
  assert.equal(
    sql.prepare("SELECT count(*) AS n FROM venues WHERE source='staging'").get()
      .n,
    1,
  );
});
test("expired state cannot exchange; ciphertext tampering fails", async () => {
  const r = await start(
    new Request("https://tabletalk.test/api/auth/blackbird/start"),
  );
  const state = new URL(r.headers.get("location")).searchParams.get("state");
  cookieJar.set("tt_oauth", state);
  sql.prepare("UPDATE oauth_states SET expires_at=0").run();
  const before = calls.length;
  const r2 = await callback(
    new Request(
      "https://tabletalk.test/api/auth/blackbird/callback?state=" +
        state +
        "&code=x",
    ),
  );
  assert.match(r2.headers.get("location"), /auth_error/);
  assert.equal(calls.length, before);
  const encrypted = await encryptToken("secret");
  await assert.rejects(() =>
    decryptToken(encrypted.slice(0, 8) + "AAAA" + encrypted.slice(12)),
  );
});

const post = (data) =>
  action(
    new Request("https://tabletalk.test/api/action", {
      method: "POST",
      headers: {
        origin: "https://tabletalk.test",
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    }),
  );
const review = {
  action: "review",
  venueId: locationId,
  rating: 9.2,
  body: "A verified dinner",
  dish: "Pasta",
  visitedAt: "2026-09-01",
};

test("reviews require the same Blackbird member and exact location, including edits and public visibility", async () => {
  const member = sql
    .prepare("SELECT id FROM profiles WHERE external_id=?")
    .get("staging:" + id).id;
  const originalSession = cookieJar.get("tt_session");
  const proof = sql.prepare("SELECT * FROM visits WHERE user_id=?").get(member);
  sql.prepare("DELETE FROM visits WHERE user_id=?").run(member);
  assert.equal(
    (await post({ ...review, verified: true, userId: member })).status,
    403,
  );
  assert.equal(sql.prepare("SELECT count(*) AS n FROM reviews").get().n, 0);
  // Only a successful member import establishes the proof; restore that imported record.
  sql
    .prepare("INSERT INTO visits VALUES(?,?,?)")
    .run(proof.user_id, proof.venue_id, proof.visited_at);
  assert.equal((await post(review)).status, 200);
  assert.equal((await post({ ...review, rating: 9.5 })).status, 200);
  const published = (await (await state()).json()).reviews;
  assert.equal(published.length, 1);
  assert.equal(published[0].verified, 1);
  assert.equal(published[0].rating, 9.5);
  const secondLocation = "other-location-same-brand";
  sql
    .prepare(
      "INSERT INTO venues SELECT ?,name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,source,updated_at FROM venues WHERE id=?",
    )
    .run(secondLocation, locationId);
  assert.equal(
    (await post({ ...review, venueId: secondLocation })).status,
    403,
  );
  sql.prepare("DELETE FROM venues WHERE id=?").run(secondLocation);
  for (const [other, demo, external] of [
    ["other-member", 0, "staging:other"],
    ["demo-member", 1, null],
    ["platform-member", 0, null],
    ["wrong-environment", 0, "production:other"],
  ]) {
    sql
      .prepare(
        "INSERT INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?, '', '#ed563d',?,?,?)",
      )
      .run(other, other, demo, external, at);
    const cookie = await makeSession(
      other,
      new Request("https://tabletalk.test"),
    );
    cookieJar.set("tt_session", cookie.split(";")[0].split("=")[1]);
    assert.equal(
      (await post({ ...review, userId: member, verified: true })).status,
      demo || !external ? 401 : 403,
    );
    if (other !== "other-member") {
      // Even a stray proof row cannot make a demo/platform or cross-environment identity eligible.
      sql
        .prepare("INSERT INTO visits VALUES(?,?,?)")
        .run(other, locationId, at);
      assert.equal((await post(review)).status, demo || !external ? 401 : 403);
    }
  }
  cookieJar.set("tt_session", originalSession);
  sql.prepare("DELETE FROM visits WHERE user_id=?").run(member);
  assert.equal(
    (await post({ ...review, body: "Cannot edit without proof" })).status,
    403,
  );
  assert.equal((await (await state()).json()).reviews.length, 0);
  assert.equal(sql.prepare("SELECT body FROM reviews").get().body, review.body);
  // Removing one's own review remains possible even if its proof is unavailable.
  assert.equal(
    (await post({ action: "deleteReview", reviewId: published[0].id })).status,
    200,
  );
  sql.prepare("INSERT INTO visits VALUES(?,?,?)").run(member, locationId, at);
});

test("SDK wire schemas, optional fields, date conversion and multiple pages match imported data", async () => {
  const member = sql
    .prepare("SELECT id FROM profiles WHERE external_id=?")
    .get("staging:" + id).id;
  const pages = [];
  upstreamOverride = (req) => {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    assert.equal(url.pathname, "/flynet/v1/users/me/check_ins");
    assert.equal(url.searchParams.get("page_size"), "50");
    const rich = {
      ...location,
      name: null,
      coordinate: { latitude: 40.72, longitude: -73.99 },
      phone_number: null,
      restaurant: {
        ...location.restaurant,
        price: 3,
        website_url: "https://example.com",
        asset: {
          preview_1x: null,
          web_2x: "https://example.com/food.jpg",
          full_3x: null,
        },
      },
    };
    return Response.json({
      check_ins: [
        {
          id: "check-" + page,
          object: "check_in",
          location: rich,
          blackbird_pay_enabled: false,
          created_at: page === 0 ? "2026-09-10T12:00:00Z" : at,
          ended_at: null,
        },
      ],
      pagination: {
        ...pagination,
        current_page: page,
        next_page: page === 0 ? 1 : null,
        total_pages: 2,
        total_count: 2,
      },
    });
  };
  try {
    const result = await syncVisits(member, "valid-provider-token");
    assert.deepEqual(pages, [0, 1]);
    assert.deepEqual(result, { count: 1, complete: true });
    const place = sql
      .prepare("SELECT * FROM venues WHERE id=?")
      .get(locationId);
    assert.equal(place.name, "Test brand");
    assert.equal(place.lat, 40.72);
    assert.equal(place.lng, -73.99);
    assert.equal(place.image, "https://example.com/food.jpg");
    assert.equal(place.website, "https://example.com");
    assert.equal(place.price, 3);
    assert.equal(
      sql
        .prepare("SELECT visited_at FROM visits WHERE user_id=? AND venue_id=?")
        .get(member, locationId).visited_at,
      "2026-09-10T12:00:00.000Z",
    );
    upstreamOverride = () =>
      Response.json({
        check_ins: [],
        pagination: { ...pagination, total_count: 0, total_pages: 0 },
      });
    assert.deepEqual(await syncVisits(member, "valid-provider-token"), {
      count: 0,
      complete: true,
    });
  } finally {
    upstreamOverride = undefined;
  }
});

test("invalid API shapes and empty auth errors fail closed without creating visit proofs", async () => {
  const before = sql.prepare("SELECT count(*) AS n FROM visits").get().n;
  const client = new FlynetMemberClient({
    accessToken: "valid-provider-token",
    environment: "staging",
    retryConfig: { strategy: "none" },
  });
  try {
    for (const status of [401, 403]) {
      upstreamOverride = () =>
        new Response(null, {
          status,
          headers: { "WWW-Authenticate": 'Bearer error="insufficient_scope"' },
        });
      await assert.rejects(() =>
        client.listCheckIns({ page: 0, pageSize: 50 }),
      );
    }
    upstreamOverride = () =>
      Response.json({
        check_ins: [
          {
            id: "incomplete",
            object: "check_in",
            location: { id: locationId },
            created_at: at,
          },
        ],
        pagination,
      });
    await assert.rejects(() =>
      syncVisits("other-member", "valid-provider-token"),
    );
    assert.equal(
      sql.prepare("SELECT count(*) AS n FROM visits").get().n,
      before,
    );
    upstreamOverride = () =>
      Response.json({
        check_ins: [],
        pagination: { ...pagination, next_page: 0 },
      });
    await assert.rejects(
      () => syncVisits("other-member", "valid-provider-token"),
      /did not advance/,
    );
  } finally {
    upstreamOverride = undefined;
  }
});
test("only a Blackbird identity can authenticate; retired signup never writes", async () => {
  const session = cookieJar.get("tt_session");
  cookieJar.delete("tt_session");
  requestHeaders.set("oai-authenticated-user-id", "platform-only");
  requestHeaders.set("oai-authenticated-user-email", "private@example.com");
  const before = sql.prepare("SELECT count(*) AS n FROM profiles").get().n;
  assert.equal(await currentUser(), null);
  assert.equal((await demoSignup()).status, 410);
  assert.equal(
    sql.prepare("SELECT count(*) AS n FROM profiles").get().n,
    before,
  );
  assert.equal(
    (await post({ action: "bookmark", venueId: locationId, active: true }))
      .status,
    401,
  );
  requestHeaders.clear();
  cookieJar.set("tt_session", session);
  assert.ok(await currentUser());
});
test("portal credentials without audience still produce a PKCE authorization request", async () => {
  const audience = env.FLYNET_AUDIENCE;
  delete env.FLYNET_AUDIENCE;
  try {
    const response = await start(new Request("https://tabletalk.test/api/auth/blackbird/start"));
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get("location"));
    assert.equal(url.pathname, "/oauth/authorize");
    assert.equal(url.searchParams.has("audience"), false);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(url.searchParams.get("scope"), "read:profile read:user_checkins");
  } finally {
    env.FLYNET_AUDIENCE = audience;
  }
});
test("anonymous requests share a persisted catalog and fresh reads make no provider calls", async () => {
  const savedFetch = globalThis.fetch;
  const session = cookieJar.get("tt_session");
  let requests = 0;
  sql.prepare("DELETE FROM catalog_cache").run();
  cookieJar.delete("tt_session");
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.ok(new URL(req.url).pathname.endsWith("/locations"));
    assert.equal(req.headers.get("X-API-Key"), "fly_test_fixture");
    assert.equal(req.headers.has("Authorization"), false);
    requests++;
    return Response.json({ locations: [location], pagination });
  };
  try {
    const response = await state();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.me, null);
    assert.deepEqual(body.visits, []);
    assert.deepEqual(body.catalog.locationIds, [locationId]);
    assert.ok(body.catalog.syncedAt);
    const check = await checkCatalog(new Request("https://tabletalk.test/api/flynet/discovery", { method: "POST", headers: { origin: "https://tabletalk.test" } }));
    assert.equal(check.status, 200);
    await state();
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = savedFetch;
    cookieJar.set("tt_session", session);
  }
});
test("concurrent cold requests acquire only one catalog refresh lease", async () => {
  const savedFetch = globalThis.fetch;
  sql.prepare("DELETE FROM catalog_cache").run();
  let requests = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async () => {
    requests++;
    await gate;
    return Response.json({ locations: [location], pagination });
  };
  try {
    const first = publicCatalog(false);
    await new Promise((resolve) => setImmediate(resolve));
    const others = await Promise.all([publicCatalog(false), publicCatalog(false)]);
    assert.equal(requests, 1);
    assert.ok(others.every((x) => x.syncedAt === null));
    release();
    assert.deepEqual((await first).locationIds, [locationId]);
  } finally { release(); globalThis.fetch = savedFetch; }
});
test("stale catalog remains public during background refresh and provider failures back off", async () => {
  const savedFetch = globalThis.fetch;
  const old = sql.prepare("SELECT synced_at FROM catalog_cache WHERE environment='staging:restaurant-names-v3'").get().synced_at;
  sql.prepare("UPDATE catalog_cache SET next_attempt_at=0").run();
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response(null, { status: 403 }); };
  try {
    const cached = await publicCatalog();
    assert.deepEqual(cached.locationIds, [locationId]);
    assert.equal(cached.syncedAt, old);
    await Promise.all(backgroundTasks.splice(0));
    const after = await publicCatalog();
    assert.equal(after.syncedAt, old);
    assert.deepEqual(after.locationIds, [locationId]);
    assert.equal(requests, 1);
    assert.ok(sql.prepare("SELECT next_attempt_at FROM catalog_cache WHERE environment='staging:restaurant-names-v3'").get().next_attempt_at > Date.now());
  } finally { globalThis.fetch = savedFetch; }
});
test("OAuth diagnostics omit provider payloads, tokens and unrecognized error strings", () => {
  const secret = "private-token-and-member-data";
  const diagnostic = authDiagnostic({ kind: "unknown", status: null, code: "SDKValidationError", message: secret,
    raw: { rawValue: { access_token: secret, email: secret }, cause: { issues: [{ path: ["email"], message: secret }, { path: [secret] }] } },
  });
  assert.deepEqual(diagnostic, { kind: "unknown", status: null, code: "SDKValidationError", invalidFields: ["email"] });
  assert.equal(JSON.stringify(diagnostic).includes(secret), false);
  assert.deepEqual(authDiagnostic({ kind: secret, code: secret, message: secret }), { kind: "unknown", status: null, code: null, invalidFields: [] });
});
test("automatic passport sync deduplicates requests, stays private, and preserves visits on failure", async () => {
  const user = await currentUser();
  const sessionCookie = cookieJar.get("tt_session");
  sql.prepare("UPDATE sessions SET token_expires_at=? WHERE user_id=?").run(Date.now() + 3600000, user.id);
  sql.prepare("DELETE FROM passport_syncs WHERE user_id=?").run(user.id);
  const original = globalThis.fetch;
  let requests = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let markEntered;
  const entered = new Promise(resolve => { markEntered = resolve; });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.ok(new URL(request.url).pathname.endsWith("/users/me/check_ins"));
    assert.equal(request.headers.get("Authorization"), "Bearer valid-provider-token");
    requests++;
    markEntered();
    await gate;
    return Response.json({ check_ins: [], pagination });
  };
  try {
    assert.equal((await memberPassport(user.id)).status, "syncing");
    assert.equal((await memberPassport(user.id)).status, "syncing");
    await entered;
    assert.equal(requests, 1);
    cookieJar.delete("tt_session");
    const guest = await (await state()).json();
    assert.equal(guest.passport, null);
    assert.deepEqual(guest.visits, []);
    cookieJar.set("tt_session", sessionCookie);
    release();
    await Promise.all(backgroundTasks.splice(0));
    assert.equal((await memberPassport(user.id)).status, "ready");
    assert.equal(requests, 1);
    const visitsBefore = sql.prepare("SELECT count(*) AS n FROM visits WHERE user_id=?").get(user.id).n;
    sql.prepare("UPDATE passport_syncs SET next_attempt_at=0 WHERE user_id=?").run(user.id);
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await memberPassport(user.id);
    await Promise.all(backgroundTasks.splice(0));
    assert.equal((await memberPassport(user.id)).status, "error");
    assert.equal(sql.prepare("SELECT count(*) AS n FROM visits WHERE user_id=?").get(user.id).n, visitsBefore);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal((await memberPassport(user.id, true)).status, "syncing");
    await Promise.all(backgroundTasks.splice(0));
    assert.equal((await memberPassport(user.id)).status, "reconnect");
  } finally {
    release(); await Promise.all(backgroundTasks.splice(0));
    globalThis.fetch = original; cookieJar.set("tt_session", sessionCookie);
  }
});
test("NYC coverage includes Queens postal cities and excludes nearby suburbs", () => {
  for (const [city, zipcode] of [["Astoria", "11106"], ["Long Island City", "11101"], ["Forest Hills", "11375"], ["Glendale", "11385"], ["Ridgewood", "11385-1234"], ["Jamaica", "11432"], ["Far Rockaway", "11691"], ["Glen Oaks", "11004"]]) {
    assert.equal(isNYC({ ...location, address: { ...location.address, city, zipcode } }), true, city);
  }
  for (const [city, zipcode] of [["Westbury", "11590"], ["New Hyde Park", "11040"], ["Great Neck", "11021"]]) {
    assert.equal(isNYC({ ...location, address: { ...location.address, city, zipcode } }), false, city);
  }
  assert.equal(isNYC({ ...location, address: { ...location.address, city: "Astoria", zipcode: "11106", state: "CA" } }), false);
});
test.after(() => {
  globalThis.fetch = realFetch;
  sql.close();
});

test("legacy fixtures are hidden while empty Blackbird accounts remain visible", async () => {
  const oldKey = env.FLYNET_API_KEY;
  const oldSession = cookieJar.get("tt_session");
  env.FLYNET_API_KEY = "";
  cookieJar.delete("tt_session");
  sql.prepare("INSERT INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?,'','#ed563d',0,?,?)")
    .run("empty-real", "New member", "production:new-member", at);
  sql.prepare("INSERT INTO venues SELECT 'legacy-place',name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,'demo',updated_at FROM venues WHERE id=?").run(locationId);
  for (const [list, owner] of [["legacy-list", "demo-member"], ["real-list", "empty-real"]]) {
    sql.prepare("INSERT INTO lists(id,user_id,title,description,visibility,color,created_at) VALUES(?,?,'Test list','','public','#fff',?)").run(list, owner, at);
    sql.prepare("INSERT INTO list_items VALUES(?,?,0)").run(list, locationId);
  }
  const count = sql.prepare("SELECT count(*) AS n FROM profiles").get().n;
  try {
    const data = await (await state()).json();
    assert(data.people.some(p => p.id === "empty-real"));
    assert(!data.people.some(p => p.demo || p.id === "platform-member"));
    assert(data.lists.some(l => l.id === "real-list"));
    assert(!data.lists.some(l => l.id === "legacy-list"));
    assert(!data.items.some(i => i.list_id === "legacy-list"));
    assert(!data.venues.some(v => v.source === "demo"));
    assert.equal(sql.prepare("SELECT count(*) AS n FROM profiles").get().n, count);
    const cookie = await makeSession("empty-real", new Request("https://tabletalk.test"));
    cookieJar.set("tt_session", cookie.split(";")[0].split("=")[1]);
    for (const payload of [
      {action:"follow", targetId:"demo-member", active:true},
      {action:"follow", targetId:"platform-member", active:true},
      {action:"saveList", listId:"legacy-list", active:true},
      {action:"bookmark", venueId:"legacy-place", active:true},
    ]) {
      const result = await action(new Request("https://tabletalk.test/api/action", {
        method:"POST", headers:{Origin:"https://tabletalk.test","Content-Type":"application/json"}, body:JSON.stringify(payload),
      }));
      assert.equal(result.status, 404);
    }
  } finally {
    env.FLYNET_API_KEY = oldKey;
    if (oldSession) cookieJar.set("tt_session", oldSession); else cookieJar.delete("tt_session");
  }
});


test("restaurant name takes precedence over the location label", async () => {
  const client = new FlynetMemberClient({accessToken:"valid-provider-token", environment:"staging"});
  const result = await client.listCheckIns();
  const l = result.checkIns[0].location;
  await upsertVenue({...l, name:"Nolita", restaurant:{...l.restaurant, name:"Restaurant Name"}}).run();
  assert.equal(sql.prepare("SELECT name FROM venues WHERE id=?").get(l.id).name, "Restaurant Name");
  await upsertVenue({...l, name:"Location fallback", restaurant:{...l.restaurant, name:" "}}).run();
  assert.equal(sql.prepare("SELECT name FROM venues WHERE id=?").get(l.id).name, "Location fallback");
});


test("public places and community ranking use only verified distinct locations", async () => {
  const oldKey = env.FLYNET_API_KEY;
  const oldSession = cookieJar.get("tt_session");
  env.FLYNET_API_KEY = "";
  cookieJar.delete("tt_session");
  for (const [user, count] of [["rank-explorer", 3], ["rank-new", 1]]) {
    sql.prepare("INSERT INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?,'','#fff',0,?,?)")
      .run(user,user,"staging:"+user,at);
    for (let i=0;i<count;i++) {
      const venue = "rank-place-"+i;
      sql.prepare("INSERT OR IGNORE INTO venues SELECT ?,name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,'staging',updated_at FROM venues WHERE id=?").run(venue,locationId);
      sql.prepare("INSERT OR REPLACE INTO visits VALUES(?,?,?)").run(user,venue,at);
    }
    sql.prepare("INSERT INTO lists(id,user_id,title,description,visibility,color,created_at) VALUES(?,?,'Ranking list','','public','#fff',?)")
      .run(user+"-list",user,user === "rank-new" ? "2099-01-01" : at);
  }
  // Repeat visits update the same proof, not the diner's distinct-place count.
  sql.prepare("UPDATE visits SET visited_at='2026-09-12T18:00:00Z' WHERE user_id='rank-explorer'").run();
  // A fixture identity and cross-environment location must not add public proof.
  sql.prepare("INSERT OR IGNORE INTO visits VALUES('demo-member','rank-place-0',?)").run(at);
  sql.prepare("INSERT OR IGNORE INTO visits VALUES('wrong-environment','rank-place-0',?)").run(at);
  try {
    const response = await state();
    assert.equal(response.status,200);
    const data = await response.json();
    assert.equal(data.people.find(p=>p.id==='rank-explorer').visited_count,3);
    assert.equal(data.people.find(p=>p.id==='rank-new').visited_count,1);
    assert(data.people.findIndex(p=>p.id==='rank-explorer') < data.people.findIndex(p=>p.id==='rank-new'));
    assert(data.lists.findIndex(l=>l.id==='rank-explorer-list') < data.lists.findIndex(l=>l.id==='rank-new-list'));
    assert.equal(data.publicVisits.filter(v=>v.user_id==='rank-explorer').length,3);
    assert(!data.publicVisits.some(v=>v.user_id==='demo-member' || v.user_id==='wrong-environment'));
    for (const visit of data.publicVisits) assert.deepEqual(Object.keys(visit).sort(),['user_id','venue_id']);
    assert.deepEqual(data.visits,[]);
    assert.equal(data.passport,null);
    assert(!data.people.some(p=>'external_id' in p || 'email' in p));
  } finally {
    env.FLYNET_API_KEY=oldKey;
    if(oldSession) cookieJar.set('tt_session',oldSession);
  }
});
