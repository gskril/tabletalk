import { cookies } from "next/headers";
import { db, now } from "./data";
export type User = {
  id: string;
  name: string;
  bio: string;
  color: string;
  avatar: string;
  demo: number;
};
export const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get("tt_session")?.value;
  if (token) {
    const u = await db()
      .prepare(
        "SELECT p.id,p.name,p.bio,p.color,p.avatar,p.demo FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.hash=? AND s.expires_at>? AND p.demo=0 AND (p.external_id LIKE 'staging:_%' OR p.external_id LIKE 'production:_%')",
      )
      .bind(await hash(token), Date.now())
      .first<User>();
    if (u) return u;
  }
  return null;
}
export async function makeSession(
  userId: string,
  request: Request,
  token: string | null = null,
  tokenExpiresAt: number | null = null,
  refreshToken: string | null = null,
) {
  const secret = crypto.randomUUID() + crypto.randomUUID();
  await db()
    .prepare(
      "INSERT INTO sessions(hash,user_id,expires_at,token,token_expires_at,refresh_token) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      await hash(secret),
      userId,
      Date.now() + 30 * 86400000,
      token,
      tokenExpiresAt,
      refreshToken,
    )
    .run();
  return `tt_session=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new AppError("This request must come from Tabletalk.", 403);
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Tabletalk request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return Response.json(
    {
      error:
        "Something went wrong. Your changes were not saved. Please try again.",
    },
    { status: 503 },
  );
}
