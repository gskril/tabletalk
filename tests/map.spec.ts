import { test, expect } from "@playwright/test";
import { localCatalog } from "./local-session";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
test.beforeAll(() => localCatalog(baseURL));

test("mobile map fits loaded logos and exposes usable zoom controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await (await page.request.get("/api/state")).json();
  const venues = [
    {
      ...state.venues[0],
      id: "map-logo",
      name: "Wide Logo Cafe",
      lat: 40.725,
      lng: -73.985,
      image_thumb: "https://map-assets.test/wide.svg",
      image: "",
    },
  ];
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues } }),
  );
  await page.route("https://map-assets.test/wide.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#7d2939"/><text x="600" y="380" text-anchor="middle" fill="white" font-size="240">CAFE</text></svg>',
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const map = page.getByRole("region", { name: "NYC restaurant map" });
  await map.scrollIntoViewIfNeeded();
  const marker = page.getByRole("button", { name: "Show Wide Logo Cafe" });
  const logo = marker.locator("img");
  await expect
    .poll(() => logo.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBe(1200);
  const bounds = await marker.boundingBox();
  const imageBounds = await logo.boundingBox();
  expect(imageBounds!.width).toBeLessThanOrEqual(bounds!.width);
  expect(imageBounds!.height).toBeLessThanOrEqual(bounds!.height);
  expect(imageBounds!.x).toBeGreaterThanOrEqual(bounds!.x);
  expect(imageBounds!.y).toBeGreaterThanOrEqual(bounds!.y);
  await expect(logo).toHaveCSS("object-fit", "contain");
  for (const name of ["Zoom in", "Zoom out"]) {
    const control = map.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    expect((await control.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await control.click();
  }
  await marker.focus();
  await page.keyboard.press("Space");
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("dense places cluster, zoom apart, and shared addresses stay selectable", async ({
  page,
}) => {
  const state = await (await page.request.get("/api/state")).json();
  const venues = Array.from({ length: 80 }, (_, i) => ({
    ...state.venues[0],
    id: `map-${i}`,
    name: `Map Cafe ${i}`,
    lat: 40.725 + Math.floor(i / 10) * 0.001,
    lng: -73.985 + (i % 10) * 0.001,
    image_thumb: "",
    image: "",
  }));
  venues[1].lat = venues[0].lat;
  venues[1].lng = venues[0].lng;
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { venues } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const map = page.getByRole("region", { name: "NYC restaurant map" });
  await expect(map.locator(".restaurant-cluster").first()).toBeVisible();
  expect(await map.locator(".restaurant-marker").count()).toBeLessThan(40);
  await map.locator(".restaurant-cluster").first().click();
  await expect(
    map.locator(".restaurant-marker:not(.restaurant-cluster)").first(),
  ).toBeVisible();
  // Move to the shared address, then reach maximum zoom using the visible controls.
  await page
    .locator(".map-place-picker")
    .getByRole("button", { name: "Map Cafe 0", exact: true })
    .click();
  const zoomIn = map.getByRole("button", { name: "Zoom in", exact: true });
  await expect
    .poll(
      async () => {
        if ((await zoomIn.getAttribute("aria-disabled")) === "true")
          return true;
        await zoomIn.click();
        return false;
      },
      { intervals: [600], timeout: 10000 },
    )
    .toBe(true);
  const shared = map.getByRole("button", {
    name: "Zoom in to 2 restaurants",
    exact: true,
  });
  await shared.focus();
  await page.keyboard.press("Space");
  await map
    .locator(".map-cluster-choices")
    .getByRole("button", { name: "Map Cafe 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Map Cafe 1", exact: true }),
  ).toBeVisible();
});
