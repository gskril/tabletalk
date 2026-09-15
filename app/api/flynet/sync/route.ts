import { rateLimit } from "@/lib/rate-limit";
import { currentUser, sameOrigin, AppError, failure } from "@/lib/auth";
import { db } from "@/lib/data";
import { memberPassport } from "@/lib/passport";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await currentUser();
    if (!u) throw new AppError("Sign in first.", 401);
    await rateLimit("visit-sync:" + u.id, 4, 60000);
    const passport = await memberPassport(u.id, true);
    if (passport.status === "reconnect")
      throw new AppError("Reconnect Blackbird to refresh access to your visits.", 401);
    const row = await db().prepare("SELECT count(*) AS count FROM visits WHERE user_id=?").bind(u.id).first<{ count: number }>();
    return Response.json({ ...passport, count: row?.count || 0 });
  } catch (e) {
    return failure(e);
  }
}
