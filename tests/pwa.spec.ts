import { test, expect } from "@playwright/test";

const state = {
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
test.beforeEach(async ({ page }) => {
  await page.route("**/api/state*", (route) => route.fulfill({ json: state }));
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues: [] } }),
  );
});

test("mobile installation metadata, icon assets and iPhone instructions", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  for (const icon of manifest.icons) {
    const result = await request.get(icon.src);
    expect(result.ok()).toBeTruthy();
    expect(result.headers()["content-type"]).toContain("image/png");
  }
  await page.getByRole("button", { name: "Install Tabletalk" }).click();
  await expect(page.getByRole("dialog")).toContainText("Add to Home Screen");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("offline navigation shows reconnect screen, caches no personal pages, and recovers", async ({
  page,
  context,
}) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "About Tabletalk." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys
          .filter((key) => key.startsWith("tabletalk-"))
          .map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (r) => new URL(r.url).pathname,
            ),
          ),
      )
    ).flat();
  });
  expect(cached).toEqual(["/offline.html"]);
  await context.setOffline(true);
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Your table will be here." }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "New York, by taste." }),
  ).toBeVisible();
});

test("installed iPhone hides the install action", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "About Tabletalk." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Install Tabletalk" }),
  ).toHaveCount(0);
});
