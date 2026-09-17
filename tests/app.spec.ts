import { test, expect, type Page } from "@playwright/test";
import { localSession, localCatalog, localPublicProfile } from "./local-session";
import { sampleVenues } from "../lib/sample-data";
async function join(page: Page, name: string) {
  await localSession(page.context(), baseURL, name);
  await page.reload();
  await expect(page.getByRole("link", { name: "Your profile" })).toBeVisible();
}
const baseURL = process.env.TEST_BASE_URL || "http://localhost:5173";
const headers = { Origin: baseURL };
test.beforeAll(() => localCatalog(baseURL));
test("anonymous exploration, filters, map, detail, and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Keep this fixture flow independent of real catalog rows cached locally.
  await page.route("**/api/catalog", async (route) => {
    const venues = sampleVenues.map(([id, name, cuisine, neighborhood, address, price, lat, lng, image, website, description, tags]) => ({
      id, name, cuisine, neighborhood, address, price, lat, lng, image, website, description,
      tags: JSON.stringify(tags), source: "staging", updated_at: "2026-09-17",
    }));
    await route.fulfill({ json: { venues } });
  });
  await page.goto("/explore");
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
    page.getByRole("heading", { name: "Reviews" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get directions" }),
  ).toHaveAttribute("href", /google.com\/maps/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
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
test("notebook: review gate, ordered public list across browsers, saves and follows", async ({
  page,
  browser,
}) => {
  await page.goto("/explore");
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
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "A visit comes first" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish review" }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const denied = await page.request.post("/api/action", {
    headers,
    data: {
      action: "review",
      venueId: "rubirosa",
      rating: 9,
      body: "Forged verification",
      dish: "",
      visitedAt: "2026-09-01",
      verified: true,
    },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page.getByLabel("List name").fill("E2E Downtown evening");
  await page
    .getByLabel("A note for the table")
    .fill("Three places to share with friends.");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Add Rubirosa,/ }).click();
  await dialog.getByRole("button", { name: /^Add Thai Diner,/ }).click();
  await dialog.getByRole("button", { name: /^Add BINX,/ }).click();
  await dialog.getByRole("button", { name: /^Move BINX,.* up$/ }).click();
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
  await p2.getByRole("tab", { name: "Lists", exact: true }).click();
  await expect(
    p2.getByRole("heading", { name: "E2E Downtown evening" }),
  ).toBeVisible();
  await page.goto("/feed");
  await page
    .getByRole("button", { name: "Follow", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Following", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.goto("/me");
  await expect(page.getByText("9.5", { exact: true })).toHaveCount(0);
  await other.close();
});
test("server authorization, private lists, validation, persistence, logout", async ({
  page,
  browser,
}) => {
  const request = page.request;
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
        headers,
        data: { name: "Retired signup" },
      })
    ).status(),
  ).toBe(410);
  await localSession(page.context(), baseURL, "Private owner");
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
  await localSession(other, baseURL, "Second owner");
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
test("only Blackbird sign-in is offered; legacy sessions and platform headers cannot authorize writes", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: "Join the table" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: "Connect with Blackbird" }),
  ).toHaveAttribute("href", "/api/auth/blackbird/start");
  await expect(dialog.getByText(/ChatGPT|Try the demo/)).toHaveCount(0);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await localSession(page.context(), baseURL, "Legacy demo", true);
  const spoof = {
    ...headers,
    "oai-authenticated-user-id": "fake-platform-user",
    "oai-authenticated-user-email": "fake@example.com",
  };
  expect(
    (await (await page.request.get("/api/state", { headers: spoof })).json())
      .me,
  ).toBe(null);
  expect(
    (
      await page.request.post("/api/action", {
        headers: spoof,
        data: { action: "bookmark", venueId: "rubirosa", active: true },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/demo", {
        headers,
        data: { name: "No alternative" },
      })
    ).status(),
  ).toBe(410);
});
test("passport updates automatically and only offers recovery actions when needed", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "New York, by taste." })).toBeVisible();
  await localSession(page.context(), baseURL, "Passport diner");
  let mode = "syncing";
  let reads = 0;
  await page.route(/\/api\/state(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.json();
    reads++;
    const status = mode === "syncing" && reads > 1 ? "ready" : mode;
    await route.fulfill({ response, json: { ...body, visits: [{venue_id:"rubirosa", visited_at:"2026-09-01T18:00:00Z"}], passport: { status, syncedAt: status === "ready" ? Date.now() : null, complete: true } } });
  });
  await page.goto("/saved?tab=visits");
  await expect(page.getByText("Syncing visits…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import visits", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Connect Blackbird", exact: true })).toHaveCount(0);
  await expect(page.getByText("Visits synced", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reconnect Blackbird", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Been there (1)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".visit-row h2")).toHaveText("Rubirosa");
  await expect(page.locator(".visit-row")).toContainText("Last visited Sep 1, 2026");
  await page.getByRole("tab", { name: "Lists", exact:true }).click();
  await expect(page.getByRole("heading", { name: "Created by you", exact:true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved from others", exact:true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Lists", exact:true })).toHaveAttribute("aria-selected", "true");
  await page.goto("/me");
  await expect(page.getByRole("tab", { name: "Private passport" })).toHaveCount(0);
  await page.getByRole("link", {name:"View my visit details in My notebook"}).click();
  await expect(page.locator(".visit-row h2")).toHaveText("Rubirosa");
  await page.setViewportSize({width:390, height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/notebook-been-there.png",fullPage:true});
  mode = "error";
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry sync", exact: true })).toBeVisible();
  mode = "reconnect";
  await page.reload();
  await expect(page.getByRole("link", { name: "Reconnect Blackbird", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry sync", exact: true })).toHaveCount(0);
  await page.goto("/me");
  await expect(page.getByRole("link", {name:"Reconnect Blackbird",exact:true})).toBeVisible();
  await expect(page.getByText("Reconnect to update your profile photo and latest visits. Your saved data is still here.")).toBeVisible();
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
  await page.goto("/explore");
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


test("guest profiles show verified places and full reviews without private check-in dates", async ({page}) => {
  localPublicProfile(baseURL);
  await page.goto('/profile/e2e-public-diner');
  await expect(page.getByRole('heading',{name:'Public explorer',exact:true})).toBeVisible();
  await expect(page.locator('.public-visits .visit-row')).toHaveCount(3);
  await expect(page.locator('.public-visits h2')).toHaveText(['BINX','Rubirosa','Thai Diner']);
  await expect(page.getByText(/Last visited/)).toHaveCount(0);
  await expect(page.getByRole('link',{name:'View my visit details in My notebook'})).toHaveCount(0);
  await page.getByRole('tab',{name:'Reviews (1)',exact:true}).click();
  await expect(page.getByText('A full review visible on the public profile.',{exact:true})).toBeVisible();
  await expect(page.locator('.review-head a[href="/restaurants/rubirosa"]')).toContainText('Rubirosa');
  const data = await (await page.request.get('/api/state')).json();
  expect(data.visits).toEqual([]);
  expect(data.people.find((p:{id:string})=>p.id==='e2e-public-diner').visited_count).toBe(3);
  await page.goto('/feed');
  await expect(page.getByText('Most verified places visited first.',{exact:true})).toBeVisible();
  await page.goto('/lists');
  await expect(page.getByText('Ranked by the creator’s distinct verified places visited.',{exact:true})).toBeVisible();
});


test("Blackbird avatar images render and fall back to initials on failure", async ({page}) => {
  localPublicProfile(baseURL);
  let photo = 'https://avatars.example.test/member.png';
  await page.route('https://avatars.example.test/**', async route => {
    if(route.request().url().endsWith('broken.png')) return route.abort();
    await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=','base64')});
  });
  await page.route(/\/api\/state(?:\?.*)?$/, async route => {
    const response=await route.fetch();
    const data=await response.json();
    data.people.find((p:{id:string})=>p.id==='e2e-public-diner').avatar=photo;
    await route.fulfill({response,json:data});
  });
  await page.goto('/profile/e2e-public-diner');
  const avatar=page.locator('.profile-hero .avatar');
  await expect(avatar.locator('img')).toHaveAttribute('src',photo);
  await expect.poll(()=>avatar.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  photo='https://avatars.example.test/broken.png';
  await page.reload();
  await expect(avatar).toHaveText('PE');
  await expect(avatar.locator('img')).toHaveCount(0);
});


test("restaurant photos use thumbnails in visits and responsive previews in cards", async ({page}) => {
  localPublicProfile(baseURL);
  const thumb='https://restaurant-images.example.test/preview.png';
  const medium='https://restaurant-images.example.test/web.png';
  await page.route('https://restaurant-images.example.test/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=','base64')}));
  await page.route('**/api/catalog', async route=>{
    const response=await route.fetch();const data=await response.json();
    data.venues=data.venues.map((v:object)=>({...v,image:medium,image_thumb:thumb}));
    await route.fulfill({response,json:data});
  });
  await page.goto('/profile/e2e-public-diner');
  const photos=page.locator('.visit-photo img');
  await expect(photos).toHaveCount(3);
  await expect(photos.first()).toHaveAttribute('src',thumb);
  await expect(photos.first()).toHaveAttribute('loading','lazy');
  await expect(photos.first()).toHaveAttribute('decoding','async');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.goto('/');
  const cardImage=page.locator('.venue-card img').first();
  await expect(cardImage).toBeVisible();
  await expect.poll(()=>cardImage.evaluate((img:HTMLImageElement)=>img.currentSrc)).toBe(thumb);
  await page.goto('/lists/downtown-date-night');
  await expect(page.locator('.row-photo img')).toHaveCount(4);
  await page.goto('/lists');
  await expect(page.locator('.list-cover img').first()).toBeVisible();
});


test("large catalog renders in batches and searches restaurants beyond the first batch", async ({ page }) => {
  const original = await (await page.request.get("/api/state")).json();
  const venues = Array.from({ length: 808 }, (_, index) => ({
    ...original.venues[0], id: `pagination-${index}`, name: `Restaurant ${String(index).padStart(3, "0")}`,
  }));
  await page.route("**/api/catalog", route => route.fulfill({ json: { venues, catalog: { locationIds: venues.map(v => v.id), syncedAt: Date.now() } } }));
  await page.route(/\/api\/state(?:\?.*)?$/, route => route.fulfill({ json: { ...original, items: [], publicVisits: [], visits: [] } }));
  await page.goto("/explore");
  await expect(page.locator(".venue-card")).toHaveCount(24);
  await expect(page.getByText("808 spots", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show more restaurants" }).click();
  await expect(page.locator(".venue-card")).toHaveCount(48);
  await page.getByRole("textbox", { name: "Search restaurants" }).fill("Restaurant 807");
  await expect(page.locator(".venue-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Restaurant 807", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show more restaurants" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search restaurants" }).fill("");
  await expect(page.locator(".venue-card")).toHaveCount(24);
});

test("occasion filters show counts, hide empty categories, and disclose restaurant sources", async ({ page }) => {
  await page.route('**/api/catalog', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.venues = data.venues.map((v: { name: string }) => ({ ...v, tags: v.name === 'Rubirosa' ? '["Brunch"]' : '[]', tag_sources: v.name === 'Rubirosa' ? [{ label: 'Brunch', url: 'https://www.rubirosanyc.com/menus/', checkedAt: '2026-09-16T00:00:00Z' }] : [] }));
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  const brunch = page.getByRole('button', { name: 'Brunch 1', exact: true });
  await expect(brunch).toBeVisible();
  await expect(page.getByRole('button', { name: /^Date night/ })).toHaveCount(0);
  await brunch.click();
  await expect(brunch).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.venue-card')).toHaveCount(1);
  await expect(page.getByText('Coverage is still growing', { exact: false })).toBeVisible();
  await page.locator('.venue-card').getByRole('link').first().click();
  await page.locator('.restaurant-labels summary').click();
  await expect(page.getByRole('link', { name: 'Brunch source' })).toHaveAttribute('href', 'https://www.rubirosanyc.com/menus/');
});
