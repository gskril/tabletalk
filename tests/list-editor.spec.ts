import { test, expect } from "@playwright/test";
import { localCatalog, localSession } from "./local-session";
import { sampleVenues } from "./fixtures/sample-data";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
test.beforeAll(() => localCatalog(baseURL));
for (const width of [390, 1280]) {
  test(`list editor distinguishes branches, orders and saves them at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await localSession(page.context(), baseURL, `List editor ${width}`);
    const venues = sampleVenues.slice(0, 2).map((v, i) => ({
      id: v[0],
      name: "Devoción",
      cuisine: "Coffee",
      price: 2,
      lat: v[6],
      lng: v[7],
      image: "",
      neighborhood: i ? "Williamsburg" : "Downtown Brooklyn",
      address: i
        ? "148 Grand St, Brooklyn, NY"
        : "276 Livingston St, Brooklyn, NY",
      website: "",
      description: "",
      tags: "[]",
      source: "staging",
      updated_at: "2026-09-17",
    }));
    await page.route("**/api/catalog", (route) =>
      route.fulfill({ json: { venues } }),
    );
    await page.goto("/saved?tab=lists");
    await page
      .getByRole("button", { name: "New list", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("List name").fill(`Coffee branches ${width}`);
    const search = dialog.getByLabel("Find a restaurant for your list");
    const results = dialog.locator(".list-restaurant-picker");
    const selected = dialog.locator(".selected-places");
    await search.fill("Livingston");
    await expect(results.getByRole("button")).toHaveCount(1);
    await results
      .getByRole("button", {
        name: "Add Devoción, 276 Livingston St, Brooklyn, NY",
        exact: true,
      })
      .click();
    await expect(
      results.getByRole("button", { name: /^Added Devoción/ }),
    ).toBeDisabled();
    await expect(selected).toContainText("276 Livingston St");
    await search.fill("devoción");
    await results
      .getByRole("button", {
        name: "Add Devoción, 148 Grand St, Brooklyn, NY",
        exact: true,
      })
      .click();
    await expect(selected.locator("li")).toHaveCount(2);
    await expect(results.getByRole("button")).toHaveCount(2);
    // Adding does not remove/reorder search rows, and text starts next to its image.
    await expect(results.getByRole("button").first()).toContainText(
      "276 Livingston St",
    );
    await expect(results.locator(".picker-place-details").first()).toHaveCSS(
      "text-align",
      "left",
    );
    const photo = await results.locator(".picker-photo").first().boundingBox();
    const text = await results
      .locator(".picker-place-details")
      .first()
      .boundingBox();
    expect(text!.x - photo!.x - photo!.width).toBeLessThanOrEqual(12);
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await dialog
      .getByRole("button", {
        name: "Move Devoción, 148 Grand St, Brooklyn, NY up",
        exact: true,
      })
      .click();
    await expect(selected.locator("li").first()).toContainText("148 Grand St");
    await selected.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/list-editor-${width}.png` });
    await dialog
      .getByRole("button", { name: "Create list", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: "Edit list", exact: true }).click();
    await expect(selected.locator("li").first()).toContainText("148 Grand St");
    await expect(selected.locator("li").nth(1)).toContainText(
      "276 Livingston St",
    );
    await dialog
      .getByRole("button", {
        name: "Remove Devoción, 148 Grand St, Brooklyn, NY",
        exact: true,
      })
      .click();
    await search.fill("Grand St");
    await expect(
      results.getByRole("button", { name: /^Add Devoción/ }),
    ).toBeEnabled();
    await search.fill("no matching cafe anywhere");
    await expect(results).toContainText("No matching restaurants");
    await dialog
      .getByRole("button", { name: "Save list", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: "Edit list", exact: true }).click();
    await expect(selected.locator("li")).toHaveCount(1);
    await expect(selected).toContainText("276 Livingston St");
  });
}
