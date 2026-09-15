import { db } from "./data";
import { AppError } from "./auth";
export async function rateLimit(key: string, limit: number, periodMs: number) {
  const time = Date.now();
  const row = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<=? THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING count",
    )
    .bind(key, time + periodMs, time, time)
    .first<{ count: number }>();
  if ((row?.count || 0) > limit)
    throw new AppError(
      "A few too many requests. Please try again shortly.",
      429,
    );
}
