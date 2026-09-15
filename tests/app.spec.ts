import { test, expect, type Page } from "@playwright/test";
async function join(page: Page, name: string) {
  await page.getByRole("button", { name: "Join the table" }).click();
  await page.getByLabel("Your display name").fill(name);
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
const headers = { Origin: baseURL };
test("anonymous exploration, filters, map, detail, and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "New York, by taste." }),
  ).toBeVisible();
  await expect(page.locator(".venue-card")).toHaveCount(12);
  await page
    .getByRole("textbox", { name: "Search restaurants" })
    .fill("Rubirosa");
  await expect(page.locator(".venue-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Rubirosa" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search restaurants" })
    .fill("does not exist");
  await expect(
    page.getByRole("heading", { name: "Nothing on this corner, yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("combobox", { name: "Neighborhood" }).click();
  await page.getByRole("option", { name: "Nolita", exact: true }).click();
  await expect(page.locator(".venue-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "NYC restaurant map" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show Thai Diner" }).click();
  await expect(
    page.getByRole("heading", { name: "Thai Diner", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View Thai Diner" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes from the table" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get directions" }),
  ).toHaveAttribute("href", /google.com\/maps/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "New York, by taste." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-explore.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("notebook: save, review CRUD, ordered public list across browsers, follow and like", async ({
  page,
  browser,
}) => {
  const uniqueReview = `A terrific test dinner ${Date.now()}.`;
  await page.goto("/");
  await join(page, "E2E Diner");
  await page
    .getByRole("button", { name: "Save Rubirosa", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unsave Rubirosa", exact: true }),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: "Rubirosa", exact: true }),
  ).toBeVisible();
  await page.goto("/restaurants/rubirosa");
  await page.getByRole("button", { name: "Write a review" }).click();
  await page.getByRole("spinbutton").fill("9.3");
  await page
    .getByLabel("The honest take")
    .fill(uniqueReview + " The crust was crisp and the company was excellent.");
  await page.getByLabel("What should we order?").fill("Tie-dye pizza");
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(uniqueReview, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Edit review", exact: true }).click();
  await page.getByRole("spinbutton").fill("9.5");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page.getByLabel("List name").fill("E2E Downtown evening");
  await page
    .getByLabel("A note for the table")
    .fill("Three places to share with friends.");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Rubirosa", exact: true }).click();
  await dialog.getByRole("button", { name: "Thai Diner", exact: true }).click();
  await dialog.getByRole("button", { name: "BINX", exact: true }).click();
  await dialog.getByRole("button", { name: "Move BINX up" }).click();
  await dialog
    .getByRole("button", { name: "Create list", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "E2E Downtown evening" }),
  ).toBeVisible();
  const url = page.url();
  await expect(page.locator(".list-row h3")).toHaveText([
    "Rubirosa",
    "BINX",
    "Thai Diner",
  ]);
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(url);
  await expect(
    p2.getByRole("heading", { name: "E2E Downtown evening" }),
  ).toBeVisible();
  await expect(
    p2.getByRole("button", { name: "Join the table" }),
  ).toBeVisible();
  await expect(
    p2.getByRole("button", { name: "Edit list", exact: true }),
  ).toHaveCount(0);
  await join(p2, "E2E Friend");
  await p2.getByRole("button", { name: "Save list", exact: true }).click();
  await p2.goto("/saved");
  await p2.getByRole("tab", { name: "Saved lists", exact: true }).click();
  await expect(
    p2.getByRole("heading", { name: "E2E Downtown evening" }),
  ).toBeVisible();
  await page.goto("/feed");
  await page
    .getByRole("button", { name: "Follow", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await expect(page.locator(".review")).not.toHaveCount(0);
  await page
    .locator(".review")
    .first()
    .getByRole("button", { name: /Like review by/ })
    .click();
  await expect(
    page
      .locator(".review")
      .first()
      .getByRole("button", { name: /Unlike review by/ }),
  ).toBeVisible();
  await page.goto("/me");
  await expect(page.locator(".list-row").first()).toContainText("9.5");
  await page.goto("/restaurants/rubirosa");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByText(uniqueReview, { exact: false })).toHaveCount(0);
  await other.close();
});
test("server authorization, private lists, validation, persistence, logout", async ({
  request,
  browser,
}) => {
  const publicState = await request.get("/api/state");
  expect(publicState.status()).toBe(200);
  const ps = await publicState.json();
  expect(ps.me).toBe(null);
  expect(JSON.stringify(ps)).not.toContain("external_id");
  expect(JSON.stringify(ps)).not.toContain("token_expires_at");
  expect(
    (
      await request.post("/api/action", {
        headers,
        data: { action: "bookmark", venueId: "rubirosa", active: true },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/demo", {
        headers: { Origin: "https://evil.example" },
        data: { name: "Attacker" },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth/demo", {
    headers,
    data: { name: "Private owner" },
  });
  let own = await (await request.get("/api/state")).json();
  expect(own.me.name).toBe("Private owner");
  const l = await request.post("/api/action", {
    headers,
    data: {
      action: "list",
      title: "Secret dinner",
      description: "Private notes",
      visibility: "private",
      venueIds: ["rubirosa", "binx"],
    },
  });
  expect(l.status()).toBe(200);
  const { id } = await l.json();
  const other = await browser.newContext();
  const p = await other.newPage();
  const response = await p.goto("/lists/" + id);
  expect(response?.status()).toBe(404);
  expect(
    JSON.stringify(
      await (await other.request.get(baseURL + "/api/state")).json(),
    ),
  ).not.toContain("Secret dinner");
  await other.request.post(baseURL + "/api/auth/demo", {
    headers,
    data: { name: "Second owner" },
  });
  expect(
    (
      await other.request.post(baseURL + "/api/action", {
        headers,
        data: { action: "deleteList", listId: id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.request.post(baseURL + "/api/action", {
        headers,
        data: { action: "saveList", listId: id, active: true },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/action", {
        headers,
        data: {
          action: "review",
          venueId: "rubirosa",
          rating: 11,
          body: "Bad score",
          dish: "",
          visitedAt: "2026-09-10",
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/action", {
        headers,
        data: {
          action: "review",
          venueId: "rubirosa",
          rating: 9,
          body: "Bad date",
          dish: "",
          visitedAt: "2026-02-31",
        },
      })
    ).status(),
  ).toBe(400);
  await request.post("/api/action", {
    headers,
    data: { action: "bookmark", venueId: "binx", active: true },
  });
  await request.post("/api/action", {
    headers,
    data: { action: "bookmark", venueId: "binx", active: true },
  });
  own = await (await request.get("/api/state")).json();
  expect(own.bookmarks.filter((x: string) => x === "binx")).toHaveLength(1);
  await request.post("/api/auth/logout", { headers });
  expect((await (await request.get("/api/state")).json()).me).toBe(null);
  await other.close();
});
test("unsupported OAuth is honest and malicious callback cannot sign in", async ({
  request,
}) => {
  const s = await request.get("/api/auth/blackbird/start", { maxRedirects: 0 });
  expect(s.status()).toBe(302);
  expect(s.headers().location).toContain("/about?connection=unavailable");
  const c = await request.get(
    "/api/auth/blackbird/callback?code=evil&state=forged",
    { maxRedirects: 0 },
  );
  expect(c.status()).toBe(302);
  expect(c.headers().location).toContain("auth_error");
  expect((await (await request.get("/api/state")).json()).me).toBe(null);
});
test("WebMCP tool contract validates input and reads the same restaurant state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tools: Record<string, unknown> = {};
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: (t: { name: string }, opts: { signal: AbortSignal }) => {
          tools[t.name] = t;
          opts.signal.addEventListener("abort", () => delete tools[t.name]);
        },
      },
    });
    (window as unknown as { testTools: unknown }).testTools = tools;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "New York, by taste." }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const tool = (
      window as unknown as {
        testTools: Record<
          string,
          { execute: (x: unknown) => Promise<unknown>; annotations: unknown }
        >;
      }
    ).testTools.search_restaurants;
    let failed = false;
    try {
      await tool.execute({ query: 42 });
    } catch {
      failed = true;
    }
    return {
      data: await tool.execute({ query: "Rubirosa" }),
      annotations: tool.annotations,
      failed,
    };
  });
  expect(result.failed).toBe(true);
  expect(result.data).toMatchObject([{ id: "rubirosa", name: "Rubirosa" }]);
  expect(result.annotations).toMatchObject({ readOnlyHint: true });
});
