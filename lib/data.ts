import { env } from "cloudflare:workers";
import { sampleVenues, samplePeople, sampleLists } from "./sample-data";
export function db() {
  if (!env.DB) throw new Error("Dining notebook is temporarily unavailable.");
  return env.DB;
}
export const now = () => new Date().toISOString();
export async function seed() {
  const d = db();
  if (await d.prepare("SELECT id FROM profiles WHERE id='demo-maya'").first())
    return;
  const at = "2026-09-14T12:00:00.000Z";
  const statements: D1PreparedStatement[] = [];
  for (const [id, name, bio, color] of samplePeople)
    statements.push(
      d
        .prepare(
          "INSERT OR IGNORE INTO profiles(id,name,bio,color,demo,created_at) VALUES(?,?,?,?,1,?)",
        )
        .bind(id, name, bio, color, at),
    );
  for (const v of sampleVenues)
    statements.push(
      d
        .prepare(
          "INSERT OR IGNORE INTO venues(id,name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,source,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(...v.slice(0, 11), JSON.stringify(v[11]), "demo", at),
    );
  for (const l of sampleLists) {
    statements.push(
      d
        .prepare(
          "INSERT OR IGNORE INTO lists(id,user_id,title,description,visibility,color,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(...l.slice(0, 6), at),
    );
    l[6].forEach((id, i) =>
      statements.push(
        d
          .prepare(
            "INSERT OR IGNORE INTO list_items(list_id,venue_id,position) VALUES(?,?,?)",
          )
          .bind(l[0], id, i),
      ),
    );
  }
  await d.batch(statements);
}
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
