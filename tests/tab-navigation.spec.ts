import { test, expect } from "@playwright/test";
const guest = {
  me: null,
  people: [],
  venues: [],
  reviews: [],
  lists: [],
  items: [],
  saved: [],
  bookmarks: [],
  following: [],
  likes: [],
  visits: [],
  publicVisits: [],
  integration: { configured: true, discovery: true, environment: "production" },
};
test.use({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/state*", (route) => route.fulfill({ json: guest }));
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues: [] } }),
  );
  await page.route("**/api/feed*", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
});

test("mobile tabs preserve the header and document without any route fetches", async ({
  page,
}) => {
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "About Tabletalk." }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { originalHeader: Element | null }).originalHeader =
      document.querySelector(".topbar");
  });
  const routeRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.isNavigationRequest() ||
      request.headers().rsc ||
      request.url().includes(".rsc")
    )
      routeRequests.push(request.url());
  });
  for (const [label, path, heading] of [
    ["Explore", "/explore", "New York, by taste."],
    ["Lists", "/lists", "Lists to keep and share."],
    ["My notebook", "/saved", "Your notebook starts here"],
    ["Home", "/", "At your table."],
  ]) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: label, exact: true })
      .tap();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/" : path}$`));
    if (label !== "My notebook")
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { originalHeader: Element }).originalHeader ===
          document.querySelector(".topbar"),
      ),
    ).toBe(true);
  }
  expect(routeRequests).toEqual([]);
  await page.goBack();
  await expect(page).toHaveURL(/\/saved$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Lists to keep and share." }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/saved$/);
  expect(routeRequests).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { originalHeader: Element }).originalHeader ===
        document.querySelector(".topbar"),
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "My notebook", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("sign-in links retain native navigation", async ({ page }) => {
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "About Tabletalk." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Join the table/ }).click();
  await expect(
    page.getByRole("link", { name: /Connect with Blackbird/ }),
  ).toHaveAttribute("href", "/api/auth/blackbird/start");
});

test("explore filters are kept in the URL and restored on back", async ({
  page,
}) => {
  const venue = (id: string, name: string, cuisine: string, price: number) => ({
    id,
    name,
    cuisine,
    neighborhood: "SoHo",
    address: "",
    price,
    lat: null,
    lng: null,
    image: "",
    website: "",
    description: "",
    tags: "",
    source: "test",
    updated_at: "2026-09-01",
  });
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      json: {
        venues: [
          venue("v1", "Noodle Bar", "Ramen", 2),
          venue("v2", "Taco Spot", "Mexican", 1),
          venue("v3", "Ramen House", "Ramen", 3),
        ],
      },
    }),
  );
  await page.goto("/explore");
  await page.getByLabel("Search restaurants").fill("ramen");
  await page.getByRole("button", { name: "Map", exact: true }).tap();
  await page.getByRole("button", { name: "Grid", exact: true }).tap();
  await expect(page).toHaveURL(/\/explore\?q=ramen$/);
  await expect(page.getByText("2 spots")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Lists", exact: true })
    .tap();
  await expect(page).toHaveURL(/\/lists$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/explore\?q=ramen$/);
  await expect(page.getByLabel("Search restaurants")).toHaveValue("ramen");
  await expect(page.getByText("2 spots")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search restaurants")).toHaveValue("ramen");
  await expect(page.getByText("2 spots")).toBeVisible();
});
