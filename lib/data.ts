import { env } from "cloudflare:workers";
export function db() {
  if (!env.DB) throw new Error("Dining notebook is temporarily unavailable.");
  return env.DB;
}
export const now = () => new Date().toISOString();
// Public identities must have completed Blackbird sign-in. Legacy fixtures stay
// stored for reference but are never returned or available for new interactions.
export const memberProfileIds = "SELECT id FROM profiles WHERE demo=0 AND (external_id LIKE 'staging:_%' OR external_id LIKE 'production:_%')";
export const memberListIds = `SELECT id FROM lists WHERE user_id IN (${memberProfileIds})`;
export async function all<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
) {
  return (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
