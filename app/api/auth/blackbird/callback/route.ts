import { cookies } from "next/headers";
import { FlynetMemberClient } from "@flynetdev/core";
import { exchangeAuthorizationCode, settings, encryptToken } from "@/lib/flynet";
import { db, now } from "@/lib/data";
import { hash, makeSession } from "@/lib/auth";
import { authDiagnostic } from "@/lib/auth-diagnostics";
export async function GET(req: Request) {
  let phase = "state";
  const clear =
    "tt_oauth=; Path=/api/auth/blackbird; HttpOnly; SameSite=Lax; Max-Age=0";
  try {
    const u = new URL(req.url);
    const state = u.searchParams.get("state"),
      code = u.searchParams.get("code"),
      cookie = (await cookies()).get("tt_oauth")?.value;
    if (!state || !code || state !== cookie || u.searchParams.has("error"))
      throw new Error("Invalid OAuth state");
    phase = "expired";
    // DELETE RETURNING consumes state atomically, so replayed/concurrent callbacks cannot exchange twice.
    const pending = await db()
      .prepare(
        "DELETE FROM oauth_states WHERE hash=? AND expires_at>? RETURNING verifier,return_to",
      )
      .bind(await hash(state), Date.now())
      .first<{ verifier: string; return_to: string }>();
    if (!pending) throw new Error("Expired OAuth state");
    phase = "token";
    const tokens = await exchangeAuthorizationCode(code, pending.verifier);
    phase = "token_response";
    if (typeof tokens.access_token !== "string" || !tokens.access_token ||
        typeof tokens.expires_in !== "number" || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0)
      throw new Error("Invalid token response");
    phase = "profile";
    const member = new FlynetMemberClient({
      accessToken: tokens.access_token,
      environment: settings().environment,
      timeoutMs: 15000,
    });
    const profile = await member.getProfile();
    if (!profile.id) throw new Error("Missing member identity");
    phase = "account";
    const externalId = settings().environment + ":" + profile.id;
    const candidate = crypto.randomUUID();
    await db()
      .prepare(
        "INSERT OR IGNORE INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?,?,?,0,?,?)",
      )
      .bind(
        candidate,
        profile.firstName || "NYC diner",
        "",
        "#ed563d",
        externalId,
        now(),
      )
      .run();
    const account = await db()
      .prepare("SELECT id FROM profiles WHERE external_id=?")
      .bind(externalId)
      .first<{ id: string }>();
    if (!account) throw new Error("Missing account");
    phase = "session";
    // Deliberately do not retain the refresh token: reconnect after access expiry, avoiding rotating-token races.
    const headers = new Headers({
      Location: new URL("/me?connected=1", req.url).toString(),
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", clear);
    headers.append(
      "Set-Cookie",
      await makeSession(
        account.id,
        req,
        await encryptToken(tokens.access_token),
        Date.now() + tokens.expires_in * 1000,
      ),
    );
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const reference = crypto.randomUUID().slice(0, 8);
    console.error("Blackbird sign-in failed", { reference, phase, ...authDiagnostic(error) });
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL(`/me?auth_error=${phase}&auth_ref=${reference}`, req.url).toString(),
        "Set-Cookie": clear,
        "Cache-Control": "no-store",
      },
    });
  }
}
