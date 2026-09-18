import { test, expect } from "@playwright/test";

// Keep synthetic document interception independent of the offline worker.
test.use({ serviceWorkers: "block" });

for (const width of [
  320, 360, 390, 430, 600, 760, 768, 820, 960, 961, 1024, 1440,
]) {
  test(`profile names and controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let name = "Dylan";
    const viewer = {
      id: "viewer",
      name: "Viewer",
      bio: "",
      color: "#7d2939",
      demo: 0,
    };
    await page.route("**/api/state*", (route) =>
      route.fulfill({
        json: {
          me: viewer,
          people: [
            viewer,
            {
              ...viewer,
              id: "layout-target",
              name,
              bio: "Always looking for a great dinner with friends.",
            },
          ],
          venues: [],
          reviews: [],
          lists: [],
          items: [],
          saved: [],
          bookmarks: [],
          following: ["layout-target"],
          likes: [],
          visits: [],
          publicVisits: [],
          integration: {
            configured: true,
            discovery: true,
            environment: "production",
          },
        },
      }),
    );
    await page.route("**/api/catalog", (route) =>
      route.fulfill({ json: { venues: [] } }),
    );
    // Reuse the public page shell so this layout fixture requires no database writes.
    await page.route("**/profile/layout-target", async (route) => {
      const response = await route.fetch({
        url: new URL("/me", route.request().url()).href,
      });
      await route.fulfill({ response });
    });
    for (name of ["Dylan", "Elizabeth", "Elizabeth Montgomery-Worthington"]) {
      await page.goto("/profile/layout-target", {
        waitUntil: "domcontentloaded",
      });
      const hero = page.locator(".profile-hero");
      await expect(
        hero.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(
        hero.getByRole("button", { name: "Following", exact: true }),
      ).toBeVisible();
      const layout = await hero.evaluate((element) => {
        const heading = element.querySelector("h1")!;
        const range = document.createRange();
        range.setStart(heading.firstChild!, 0);
        range.setEnd(
          heading.firstChild!,
          heading.textContent!.split(" ")[0].length,
        );
        const actions = element
          .querySelector(".profile-actions")!
          .getBoundingClientRect();
        const rect = heading.getBoundingClientRect();
        return {
          firstNameLines: range.getClientRects().length,
          headingBottom: rect.bottom,
          actionsTop: actions.top,
          overflow: document.documentElement.scrollWidth > innerWidth,
          controlsFit: [...element.querySelectorAll("button")].every(
            (button) => {
              const box = button.getBoundingClientRect();
              return (
                box.left >= 0 &&
                box.right <= innerWidth &&
                button.scrollWidth <= button.clientWidth
              );
            },
          ),
        };
      });
      expect(layout.firstNameLines).toBe(1);
      expect(layout.overflow).toBe(false);
      expect(layout.controlsFit).toBe(true);
      if (width <= 960)
        expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.headingBottom);
    }
    if ([390, 768, 961].includes(width))
      await page
        .locator(".profile-hero")
        .screenshot({ path: `/tmp/tabletalk-profile-${width}.png` });
  });
}
