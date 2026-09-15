import { readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { sampleVenues, samplePeople, sampleLists } from "../lib/sample-data";
import type { BrowserContext } from "@playwright/test";

// Test-only database setup, never an application route. Refuse production URLs.
// OAuth itself is exercised through the actual callback in flynet.contract.mjs.
export async function localSession(
  context: BrowserContext,
  baseURL: string,
  name: string,
  legacy = false,
) {
  const url = new URL(baseURL);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error(
      "Local session fixtures may only target a local test Worker.",
    );
  const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const files = readdirSync(directory).filter(
    (f) => f.endsWith(".sqlite") && f !== "metadata.sqlite",
  );
  if (files.length !== 1) throw new Error("Expected one local test database.");
  const sql = new DatabaseSync(`${directory}/${files[0]}`);
  const id = randomUUID(),
    token = randomUUID() + randomUUID();
  try {
    sql.exec("PRAGMA busy_timeout=5000");
    sql
      .prepare(
        "INSERT INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?, '', '#ed563d',?,?,?)",
      )
      .run(
        id,
        name,
        legacy ? 1 : 0,
        legacy ? null : "staging:" + randomUUID(),
        new Date().toISOString(),
      );
    sql
      .prepare("INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        id,
        Date.now() + 3600000,
      );
  } finally {
    sql.close();
  }
  await context.addCookies([
    {
      name: "tt_session",
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// Browser fixtures are provisioned explicitly, outside the application runtime.
export function localCatalog(baseURL: string) {
  const url = new URL(baseURL);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Catalog fixtures may only target a local test Worker.");
  const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const files = readdirSync(directory).filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) throw new Error("Expected one local test database.");
  const sql = new DatabaseSync(`${directory}/${files[0]}`);
  const at = new Date().toISOString();
  try {
    sql.exec("PRAGMA busy_timeout=5000");
    for (const [id, name, bio, color] of samplePeople)
      sql.prepare("INSERT INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES(?,?,?,?,0,?,?) ON CONFLICT(id) DO UPDATE SET demo=0,external_id=excluded.external_id")
        .run(id,name,bio,color,"staging:test-"+id,at);
    for (const v of sampleVenues)
      sql.prepare("INSERT INTO venues(id,name,cuisine,neighborhood,address,price,lat,lng,image,website,description,tags,source,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source='staging'")
        .run(...v.slice(0,11) as [string,string,string,string,string,number,number,number,string,string,string], JSON.stringify(v[11]),"staging",at);
    for (const l of sampleLists) {
      sql.prepare("INSERT OR IGNORE INTO lists(id,user_id,title,description,visibility,color,created_at) VALUES(?,?,?,?,?,?,?)").run(...l.slice(0,6) as [string,string,string,string,string,string],at);
      l[6].forEach((id,i)=>sql.prepare("INSERT OR IGNORE INTO list_items VALUES(?,?,?)").run(l[0],id,i));
    }
  } finally { sql.close(); }
}

export function localPublicProfile(baseURL: string) {
  localCatalog(baseURL); // Includes the local-only origin and database checks.
  const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const file = readdirSync(directory).find(f => f.endsWith(".sqlite") && f !== "metadata.sqlite")!;
  const sql = new DatabaseSync(`${directory}/${file}`);
  try {
    sql.exec("PRAGMA busy_timeout=5000");
    sql.prepare("INSERT OR IGNORE INTO profiles(id,name,bio,color,demo,external_id,created_at) VALUES('e2e-public-diner','Public explorer','','#ed563d',0,'staging:public-explorer','2026-09-01')").run();
    for(const id of ['rubirosa','binx','thai-diner']) sql.prepare("INSERT OR REPLACE INTO visits VALUES('e2e-public-diner',?,'2026-09-07T18:45:00Z')").run(id);
    sql.prepare("INSERT OR REPLACE INTO reviews(id,user_id,venue_id,rating,body,dish,visited_at,created_at) VALUES('e2e-public-review','e2e-public-diner','rubirosa',9.2,'A full review visible on the public profile.','Pizza','2026-09-07','2026-09-08')").run();
  } finally {sql.close();}
}
