import { readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
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
