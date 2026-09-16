import { test, expect } from "@playwright/test";
import { localPublicProfile, localSession } from "./local-session";
import { sampleVenues } from "../lib/sample-data";
const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
test.beforeAll(() => localPublicProfile(baseURL));
test("follow a diner, browse real check-ins and reviews, and keep a restaurant for later", async ({
  page,
}) => {
  await localSession(page.context(), baseURL, "Feed reader");
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
  await page.goto("/feed");
  await expect(
    page.getByRole("tab", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Good taste is better shared." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Find people" })
    .fill("Public explorer");
  await page
    .locator(".person")
    .getByRole("button", { name: "Follow", exact: true })
    .click();
  const cards = page.locator(".feed-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toHaveAttribute("data-activity-type", "review");
  await expect(cards.first()).toContainText(
    "A full review visible on the public profile.",
  );
  await page.getByRole("button", { name: "Check-ins", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toHaveAttribute("data-activity-type", "checkin");
  await page.getByRole("button", { name: "Save BINX", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave BINX", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reviews", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole("button", { name: "All activity", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/friends-feed-mobile.png" });
  await page.goto("/saved");
  await expect(page.locator(".venue-card h3")).toHaveText(["BINX"]);
  await page.goto("/feed");
  await expect(
    page.getByRole("button", { name: "Unsave BINX", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Find people" })
    .fill("Public explorer");
  await page
    .locator(".person")
    .getByRole("button", { name: "Following", exact: true })
    .click();
  await expect(cards).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Good taste is better shared." }),
  ).toBeVisible();
});
test("guests can read community reviews and are prompted to connect for following", async ({
  page,
}) => {
  await page.goto("/feed");
  await expect(
    page.getByRole("tab", { name: "Community", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator('.feed-card[data-activity-type="review"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('.feed-card[data-activity-type="checkin"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect with Blackbird", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Blackbird");
});
