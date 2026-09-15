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
  const samples = [
    [
      "demo-r1",
      "demo-maya",
      "rubirosa",
      9.2,
      "The kind of dinner where everyone reaches for the last slice. Come with friends and order a salad too.",
      "Tie-dye pizza",
    ],
    [
      "demo-r2",
      "demo-sam",
      "thai-diner",
      9.0,
      "A very happy lunch. Big flavors, a lively room, and plenty to come back for.",
      "Pad Thai",
    ],
    [
      "demo-r3",
      "demo-jules",
      "binx",
      8.8,
      "One round turned into dinner. Sharing plates is definitely the move.",
      "Pasta",
    ],
    [
      "demo-r4",
      "demo-jules",
      "lilia",
      9.4,
      "A pasta-centered night is always a good idea. This one made the personal shortlist.",
      "Mafaldini",
    ],
    [
      "demo-r5",
      "demo-maya",
      "via-carota",
      9.1,
      "For a slow catch-up and an extra plate for the table.",
      "Seasonal vegetables",
    ],
    [
      "demo-r6",
      "demo-sam",
      "golden-diner",
      8.7,
      "My kind of weekend pit stop. Already planning the next visit.",
      "Pancakes",
    ],
  ];
  for (const r of samples)
    statements.push(
      d
        .prepare(
          "INSERT OR IGNORE INTO reviews(id,user_id,venue_id,rating,body,dish,visited_at,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(...r, "2026-09-12", at),
    );
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
