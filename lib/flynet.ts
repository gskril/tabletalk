import { env } from "cloudflare:workers";
import {
  FlynetDiscoveryClient,
  FlynetMemberClient,
  FlynetOAuth,
  AUTH_BASE_BY_ENV,
  shapeFlynetError,
  networkFlynetError,
} from "@flynetdev/core";
import { db, now } from "./data";
import { AppError } from "./auth";
export function settings() {
  const e = env as unknown as Record<string, string | undefined>;
  return {
    clientId: e.FLYNET_CLIENT_ID || "",
    clientSecret: e.FLYNET_CLIENT_SECRET || "",
    redirectUri: e.FLYNET_REDIRECT_URI || "",
    audience: e.FLYNET_AUDIENCE || "",
    apiKey: e.FLYNET_API_KEY || "",
    encryptionKey: e.TOKEN_ENCRYPTION_KEY || "",
    environment:
      e.FLYNET_ENVIRONMENT === "production"
        ? ("production" as const)
        : ("staging" as const),
  };
}
export function integrationStatus() {
  const c = settings();
  return {
    configured: !!(
      c.clientId &&
      c.clientSecret &&
      c.redirectUri &&
      c.encryptionKey
    ),
    discovery: !!c.apiKey,
    environment: c.environment,
  };
}
export function oauth() {
  const c = settings();
  if (!integrationStatus().configured)
    throw new AppError(
      "Blackbird sign-in is awaiting partner access. You can browse restaurants and public lists meanwhile.",
      503,
    );
  return new FlynetOAuth({
    ...c,
    scopes: ["read:profile", "read:user_checkins"],
  });
}
export async function authorizationRequest() {
  const request = await oauth().getAuthorizeUrl();
  // The live gateway and OAuth guide support requests without an audience.
  // SDK 0.8.1 always serializes it, so omit it when the portal issues none.
  if (!settings().audience) {
    const url = new URL(request.url);
    url.searchParams.delete("audience");
    request.url = url.toString();
  }
  return request;
}
export async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  const c = settings();
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    code,
    code_verifier: codeVerifier,
  });
  let response: Response;
  try {
    // SDK 0.8.1's OAuth helper omits User-Agent. Workers do not supply a default;
    // Blackbird's edge rejects that request with 403 before OAuth handles it.
    response = await fetch(`${AUTH_BASE_BY_ENV[c.environment]}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "Tabletalk/1.0 (+https://your-app.example)",
      },
      body: form.toString(),
      // Workers supports manual/follow; manual keeps credentials on this endpoint.
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw networkFlynetError(error);
  }
  if (!response.ok) throw await shapeFlynetError(response);
  return response.json() as Promise<Awaited<ReturnType<FlynetOAuth["exchangeCode"]>>>;
}
async function encryptionKey() {
  const secret = settings().encryptionKey;
  if (secret.length < 32)
    throw new AppError("Blackbird token storage is not configured.", 503);
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(),
      new TextEncoder().encode(token),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...cipher));
}
export async function decryptToken(token: string) {
  const b = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b.slice(0, 12) },
      await encryptionKey(),
      b.slice(12),
    ),
  );
}
type Location = Awaited<
  ReturnType<FlynetDiscoveryClient["locations"]["getLocation"]>
>;
export function isNYC(l: Location) {
  if (!["ny", "new york"].includes(l.address?.state?.trim().toLowerCase() || "")) return false;
  const zip = l.address?.zipcode?.trim() || "";
  // NYC's published postal ranges also cover Queens neighborhood city names.
  // Mixed Nassau/Queens ZIPs (11001/11040/11096) need an explicit borough name.
  const nycZip = /^(?:(?:10[0-4]|11[1-4]|116)\d{2}|11004|11005)(?:-\d{4})?$/.test(zip);
  return (
    [
      "new york",
      "new york city",
      "brooklyn",
      "queens",
      "bronx",
      "staten island",
      "manhattan",
    ].includes(l.address?.city?.trim().toLowerCase() || "") || nycZip
  );
}
export function upsertVenue(l: Location) {
  const r = l.restaurant;
  const addr = l.address;
  return db()
    .prepare(
      "INSERT INTO venues(id,name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,source,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cuisine=excluded.cuisine,neighborhood=excluded.neighborhood,address=excluded.address,price=excluded.price,lat=excluded.lat,lng=excluded.lng,image=excluded.image,website=excluded.website,source=excluded.source,updated_at=excluded.updated_at",
    )
    .bind(
      l.id,
      l.name || r.name,
      r.cuisine?.join(", ") || "Restaurant",
      l.neighborhood?.name || addr?.city || "New York",
      [addr?.street, addr?.city, addr?.state].filter(Boolean).join(", "),
      Math.max(1, Math.min(4, r.price || 2)),
      l.coordinate?.latitude ?? null,
      l.coordinate?.longitude ?? null,
      r.asset?.web2x || r.asset?.preview1x || "",
      r.websiteUrl || "",
      "A restaurant on the Blackbird network.",
      "[]",
      settings().environment,
      now(),
    );
}
export async function syncDiscovery() {
  const c = settings();
  if (!c.apiKey)
    throw new AppError(
      "Restaurant discovery is awaiting a Flynet API key.",
      503,
    );
  const client = new FlynetDiscoveryClient({
    apiKey: c.apiKey,
    environment: c.environment,
    timeoutMs: 15000,
  });
  let page: number | undefined = 0,
    count = 0;
  const locationIds = new Set<string>();
  for (let n = 0; n < 40 && page !== undefined; n++) {
    const result = await client.locations.listLocations({ page, pageSize: 50 });
    const locations = result.locations.filter(isNYC);
    if (locations.length) await db().batch(locations.map(upsertVenue));
    for (const location of locations) locationIds.add(location.id);
    count += locations.length;
    const next = result.pagination.nextPage;
    if (next === null || next === undefined)
      return { count: locationIds.size, complete: true, locationIds: [...locationIds] };
    if (next <= page)
      throw new AppError(
        "Flynet pagination did not advance. Please retry later.",
        502,
      );
    page = next;
  }
  return { count, complete: false, locationIds: [...locationIds] };
}
export async function syncVisits(userId: string, accessToken: string) {
  const client = new FlynetMemberClient({
    accessToken,
    environment: settings().environment,
    timeoutMs: 15000,
  });
  let page: number | undefined = 0;
  const seen = new Map<string, string>();
  for (let n = 0; n < 40 && page !== undefined; n++) {
    const result = await client.listCheckIns({ page, pageSize: 50 });
    const checks = result.checkIns.filter((c) => isNYC(c.location));
    const stmts: D1PreparedStatement[] = [];
    for (const c of checks) {
      const visited = c.createdAt.toISOString();
      if (seen.has(c.location.id)) continue;
      seen.set(c.location.id, visited);
      stmts.push(upsertVenue(c.location));
      stmts.push(
        db()
          .prepare(
            "INSERT INTO visits(user_id,venue_id,visited_at) VALUES(?,?,?) ON CONFLICT(user_id,venue_id) DO UPDATE SET visited_at=MAX(visits.visited_at,excluded.visited_at)",
          )
          .bind(userId, c.location.id, visited),
      );
    }
    if (stmts.length) await db().batch(stmts);
    const next = result.pagination.nextPage;
    if (next === null || next === undefined)
      return { count: seen.size, complete: true };
    if (next <= page)
      throw new AppError(
        "Flynet pagination did not advance. Please retry later.",
        502,
      );
    page = next;
  }
  return { count: seen.size, complete: false };
}
