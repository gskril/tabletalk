import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { env } from "./runtime-mock.mjs";
import { cookieJar } from "./headers-mock.mjs";
import { GET as start } from "../app/api/auth/blackbird/start/route.ts";
import { GET as callback } from "../app/api/auth/blackbird/callback/route.ts";
import { POST as sync } from "../app/api/flynet/sync/route.ts";
import { syncDiscovery, encryptToken, decryptToken } from "../lib/flynet.ts";
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
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  calls.push(req.clone());
  const p = new URL(req.url).pathname;
  if (p.endsWith("/oauth/token")) {
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
  const state = url.searchParams.get("state");
  cookieJar.set("tt_oauth", state);
  const forged = await callback(
    new Request(
      "https://tabletalk.test/api/auth/blackbird/callback?state=wrong&code=fake",
    ),
  );
  assert.match(forged.headers.get("location"), /auth_error/);
  assert.equal(calls.length, 0);
  const cbUrl =
    "https://tabletalk.test/api/auth/blackbird/callback?state=" +
    state +
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
  assert.equal(sql.prepare("SELECT count(*) AS n FROM venues").get().n, 1);
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
test.after(() => {
  globalThis.fetch = realFetch;
  sql.close();
});
