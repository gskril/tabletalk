import { cookies } from "next/headers";
import { FlynetMemberClient } from "@flynetdev/core";
import { oauth, settings, encryptToken } from "@/lib/flynet";
import { db, now } from "@/lib/data";
import { hash, makeSession } from "@/lib/auth";
export async function GET(req: Request) {
  const clear =
    "tt_oauth=; Path=/api/auth/blackbird; HttpOnly; SameSite=Lax; Max-Age=0";
  try {
    const u = new URL(req.url);
    const state = u.searchParams.get("state"),
      code = u.searchParams.get("code"),
      cookie = (await cookies()).get("tt_oauth")?.value;
    if (!state || !code || state !== cookie || u.searchParams.has("error"))
      throw new Error("Invalid OAuth state");
    // DELETE RETURNING consumes state atomically, so replayed/concurrent callbacks cannot exchange twice.
    const pending = await db()
      .prepare(
        "DELETE FROM oauth_states WHERE hash=? AND expires_at>? RETURNING verifier,return_to",
      )
      .bind(await hash(state), Date.now())
      .first<{ verifier: string; return_to: string }>();
    if (!pending) throw new Error("Expired OAuth state");
    const tokens = await oauth().exchangeCode({
      code,
      codeVerifier: pending.verifier,
    });
    const member = new FlynetMemberClient({
      accessToken: tokens.access_token,
      environment: settings().environment,
      timeoutMs: 15000,
    });
    const profile = await member.getProfile();
    if (!profile.id) throw new Error("Missing member identity");
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
  } catch {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/me?auth_error=connection", req.url).toString(),
        "Set-Cookie": clear,
        "Cache-Control": "no-store",
      },
    });
  }
}
