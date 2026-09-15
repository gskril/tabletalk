import { oauth, integrationStatus } from "@/lib/flynet";
import { db } from "@/lib/data";
import { hash } from "@/lib/auth";
export async function GET(req: Request) {
  if (!integrationStatus().configured)
    return Response.redirect(new URL("/about?connection=unavailable", req.url));
  try {
    const { url, state, codeVerifier } = await oauth().getAuthorizeUrl();
    await db()
      .prepare("DELETE FROM oauth_states WHERE expires_at<?")
      .bind(Date.now())
      .run();
    await db()
      .prepare(
        "INSERT INTO oauth_states(hash,verifier,expires_at,return_to) VALUES(?,?,?,?)",
      )
      .bind(await hash(state), codeVerifier, Date.now() + 600000, "/me")
      .run();
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
        "Set-Cookie": `tt_oauth=${state}; Path=/api/auth/blackbird; HttpOnly; SameSite=Lax; Max-Age=600${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch {
    return Response.redirect(new URL("/me?auth_error=unavailable", req.url));
  }
}
