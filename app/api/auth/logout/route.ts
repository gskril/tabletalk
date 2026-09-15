import { cookies } from "next/headers";
import { db } from "@/lib/data";
import { hash, sameOrigin, failure } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const token = (await cookies()).get("tt_session")?.value;
    if (token)
      await db()
        .prepare("DELETE FROM sessions WHERE hash=?")
        .bind(await hash(token))
        .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie":
            "tt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
