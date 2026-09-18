import { test, expect } from "@playwright/test";

const person = (id: string, name: string) => ({
  id,
  name,
  bio: "",
  color: "#ed563d",
  demo: 0,
});
const venues = ["Popular", "Repeat favorite", "Unknown count"].map(
  (name, i) => ({
    id: `social-${i}`,
    name,
    cuisine: "Italian",
    neighborhood: "Nolita",
    address: "NYC",
    price: 2,
    lat: null,
    lng: null,
    image: "",
    website: "",
    description: "",
    tags: "[]",
    source: "production",
    updated_at: "2026-09-17",
  }),
);
const state = {
  me: person("me", "My diner"),
  people: [
    person("me", "My diner"),
    person("friend", "Maya"),
    person("stranger", "Alex"),
  ],
  venues,
  reviews: [],
  lists: [],
  items: [],
  saved: [],
  bookmarks: [],
  following: ["friend"],
  likes: [],
  visits: [],
  publicVisits: [
    { user_id: "stranger", venue_id: "social-0", visit_count: 100 },
    { user_id: "friend", venue_id: "social-0", visit_count: 2 },
    { user_id: "friend", venue_id: "social-1", visit_count: 5 },
    { user_id: "friend", venue_id: "social-2", visit_count: null },
  ],
  integration: { configured: true, discovery: true, environment: "production" },
};
test("following sort counts repeat visits, excludes strangers, and preserves unknown counts", async ({
  page,
}) => {
  await page.route("**/api/state*", (route) => route.fulfill({ json: state }));
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues } }),
  );
  await page.goto("/explore");
  await page
    .getByRole("combobox", { name: "Sort restaurants" })
    .selectOption("following");
  await expect(page.locator(".venue-card h3")).toHaveText([
    "Repeat favorite",
    "Popular",
    "Unknown count",
  ]);
  await expect(page.locator(".venue-card").first()).toContainText(
    "Maya has been here",
  );
  await expect(page.locator(".venue-card")).not.toContainText([
    "Alex",
    "Alex",
    "Alex",
  ]);
  await page
    .getByRole("textbox", { name: "Search restaurants" })
    .fill("Unknown");
  await expect(page.locator(".venue-card h3")).toHaveText(["Unknown count"]);
});

test("profile sharing copies the public profile URL instead of /me", async ({
  page,
}) => {
  await page.route("**/api/state*", (route) => route.fulfill({ json: state }));
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues } }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (url: string) => {
          (window as unknown as { copied: string }).copied = url;
        },
      },
    });
  });
  await page.goto("/me");
  await page.getByRole("button", { name: "Share profile" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { copied: string }).copied),
    )
    .toMatch(/\/profile\/me$/);
});

for (const editing of [false, true]) {
  test(`review date uses imported NYC date${editing ? " and preserves existing review date" : " by default"}`, async ({
    page,
  }) => {
    const reviewState = {
      ...state,
      visits: [
        {
          venue_id: "social-0",
          visited_at: "2026-09-16T01:00:00.000Z",
          visit_count: 3,
        },
      ],
      reviews: editing
        ? [
            {
              id: "review",
              user_id: "me",
              venue_id: "social-0",
              rating: 8,
              body: "Great meal",
              dish: "Pasta",
              visited_at: "2026-09-01",
              created_at: "2026-09-02",
              name: "My diner",
              color: "#ed563d",
              demo: 0,
              verified: 1,
              likes: 0,
            },
          ]
        : [],
    };
    await page.route("**/api/state*", (route) =>
      route.fulfill({ json: reviewState }),
    );
    await page.route("**/api/catalog", (route) =>
      route.fulfill({ json: { venues } }),
    );
    let submitted: { visitedAt?: string } = {};
    await page.route("**/api/action", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { id: "review" } });
    });
    await page.goto("/saved?tab=visits");
    await page
      .getByRole("button", { name: editing ? "Edit review" : "Write a review" })
      .click();
    const dates = page.getByRole("combobox", { name: "When did you visit?" });
    await expect(dates).toHaveValue(editing ? "2026-09-01" : "2026-09-15");
    await expect(dates.locator("option")).toHaveCount(editing ? 2 : 1);
    await dates.selectOption("2026-09-15");
    await page
      .getByRole("textbox", { name: "The honest take" })
      .fill("Excellent pasta");
    await page
      .getByRole("button", {
        name: editing ? "Save review" : "Publish review",
        exact: true,
      })
      .click();
    await expect.poll(() => submitted.visitedAt).toBe("2026-09-15");
  });
}
