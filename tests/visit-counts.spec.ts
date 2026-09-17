import { test, expect } from "@playwright/test";
import { localPublicProfile } from "./local-session";
import { sampleVenues } from "./fixtures/sample-data";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
test.beforeAll(() => {
  localPublicProfile(baseURL);
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".sqlite") && f !== "metadata.sqlite",
  );
  if (files.length !== 1) throw Error("Expected one local test database");
  const sql = new DatabaseSync(`${dir}/${files[0]}`);
  for (const [venue, count] of [
    ["binx", 5],
    ["rubirosa", 2],
  ] as const)
    for (let i = 0; i < count; i++)
      sql
        .prepare(
          "INSERT OR IGNORE INTO visit_checkins(user_id,checkin_id,venue_id) VALUES('e2e-public-diner',?,?)",
        )
        .run(`count-${venue}-${i}`, venue);
  sql.close();
});
test("public Been there shows repeat visits first and leaves legacy counts unknown", async ({
  page,
}) => {
  const venues = sampleVenues.map(
    ([
      id,
      name,
      cuisine,
      neighborhood,
      address,
      price,
      lat,
      lng,
      image,
      website,
      description,
      tags,
    ]) => ({
      id,
      name,
      cuisine,
      neighborhood,
      address,
      price,
      lat,
      lng,
      image,
      website,
      description,
      tags: JSON.stringify(tags),
      source: "staging",
      updated_at: "2026-09-17",
    }),
  );
  await page.route("**/api/catalog", (r) => r.fulfill({ json: { venues } }));
  await page.goto("/profile/e2e-public-diner");
  const rows = page.locator(".public-visits .visit-row");
  await expect(rows.locator("h2")).toHaveText([
    "BINX",
    "Rubirosa",
    "Thai Diner",
  ]);
  await expect(rows.locator(".verified")).toHaveText([
    "5 verified visits",
    "2 verified visits",
    "Visited",
  ]);
  await expect(
    page.getByRole("tab", { name: "Been there (3)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(rows.locator("h2")).toHaveText([
    "BINX",
    "Rubirosa",
    "Thai Diner",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await rows.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/visit-counts-mobile.png" });
  const state = await (
    await page.request.get("/api/state?catalog=separate")
  ).json();
  const visits = state.publicVisits.filter(
    (v: { user_id: string }) => v.user_id === "e2e-public-diner",
  );
  expect(
    visits.find((v: { venue_id: string }) => v.venue_id === "binx").visit_count,
  ).toBe(5);
  expect(
    visits.find((v: { venue_id: string }) => v.venue_id === "thai-diner")
      .visit_count,
  ).toBeNull();
  expect(state.visits).toEqual([]);
  expect(Object.keys(visits[0]).sort()).toEqual([
    "user_id",
    "venue_id",
    "visit_count",
  ]);
});
