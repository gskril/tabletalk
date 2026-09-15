import { rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { currentUser, hash, sameOrigin, AppError, failure } from "@/lib/auth";
import { db } from "@/lib/data";
import { decryptToken, syncVisits } from "@/lib/flynet";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await currentUser();
    if (!u) throw new AppError("Sign in first.", 401);
    const token = (await cookies()).get("tt_session")?.value;
    if (!token)
      throw new AppError("Connect Blackbird before importing visits.", 401);
    const s = await db()
      .prepare(
        "SELECT token,token_expires_at FROM sessions WHERE hash=? AND user_id=? AND expires_at>?",
      )
      .bind(await hash(token), u.id, Date.now())
      .first<{ token: string | null; token_expires_at: number | null }>();
    if (!s?.token || !s.token_expires_at || s.token_expires_at < Date.now())
      throw new AppError(
        "Reconnect Blackbird to refresh access to your visits.",
        401,
      );
    await rateLimit("visit-sync:" + u.id, 4, 60000);
    return Response.json(await syncVisits(u.id, await decryptToken(s.token)));
  } catch (e) {
    return failure(e);
  }
}
