import { test, expect } from "@playwright/test";
import { localPublicProfile, localSession } from "./local-session";
import { sampleVenues } from "./fixtures/sample-data";
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
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Find your people" }),
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
  await page.goto("/");
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
    page.getByRole("heading", { name: "Find your people" }),
  ).toBeVisible();
});
test("guests can read community reviews and are prompted to connect for following", async ({
  page,
}) => {
  await page.goto("/");
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

test("homepage suggests every other diner newest signup first and keeps Explore separate", async ({
  page,
}) => {
  await localSession(page.context(), baseURL, "Suggestion reader");
  await page.route("**/api/state?*", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    const person = { bio: "", color: "#802b3b", demo: 0 };
    // More visits and alphabetical order must not outrank a newer signup.
    state.people = [
      {
        ...person,
        id: "oldest",
        name: "Dylan",
        created_at: "2026-09-01T00:00:00Z",
        visited_count: 90,
      },
      {
        ...person,
        id: "middle",
        name: "Alex",
        created_at: "2026-09-02T00:00:00Z",
        visited_count: 50,
      },
      {
        ...person,
        id: "newest",
        name: "Greg",
        created_at: "2026-09-03T00:00:00Z",
        visited_count: 1,
      },
      { ...state.me, created_at: "2026-09-04T00:00:00Z" },
    ];
    await route.fulfill({ response, json: state });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your people" }),
  ).toBeVisible();
  await expect(page.locator(".person-info strong")).toHaveText([
    "Greg",
    "Alex",
    "Dylan",
  ]);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-suggestions-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "New York",
  );
  await page.locator("header .brand").click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(
    page.getByRole("tab", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/feed");
  await expect(
    page.getByRole("heading", { name: "At your table." }),
  ).toBeVisible();
});
