import { limitSignup } from "@/lib/rate-limit";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db, seed, now } from "@/lib/data";
import { sameOrigin, makeSession, failure, AppError } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if ((env as unknown as Record<string, string>).DEMO_ENABLED === "false")
      throw new AppError("Demo accounts are disabled.", 403);
    const body = z
      .object({ name: z.string().trim().min(2).max(40) })
      .parse(await req.json());
    await seed();
    await limitSignup(req);
    const id = crypto.randomUUID();
    await db()
      .prepare(
        "INSERT INTO profiles(id,name,bio,color,demo,created_at) VALUES(?,?,?, ?,1,?)",
      )
      .bind(
        id,
        body.name,
        "Exploring NYC, one table at a time.",
        "#ed563d",
        now(),
      )
      .run();
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": await makeSession(id, req) } },
    );
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        { error: "Choose a name between 2 and 40 characters." },
        { status: 400 },
      );
    return failure(e);
  }
}
