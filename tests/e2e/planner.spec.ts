import { expect, test } from "@playwright/test";

const places = [
  { id: "1", name: "Denver", label: "Denver, CO, USA", lat: 39.74, lon: -104.99, state: "CO" },
  { id: "2", name: "Phoenix", label: "Phoenix, AZ, USA", lat: 33.45, lon: -112.07, state: "AZ" },
  { id: "3", name: "Austin", label: "Austin, TX, USA", lat: 30.27, lon: -97.74, state: "TX" },
  { id: "4", name: "Savannah", label: "Savannah, GA, USA", lat: 32.08, lon: -81.09, state: "GA" },
  { id: "5", name: "Portland", label: "Portland, OR, USA", lat: 45.52, lon: -122.68, state: "OR" },
];

test("five dated stops survive refresh; settings, drag order, editing and deletion persist", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Deterministic UI fixtures only; production search always uses the ORS route.
  await page.route("**/api/geocode?*", async route => {
    const q = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill({ json: { places: places.filter(p => p.name === q) } });
  });
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "Trip settings" }).click();
  await page.getByLabel("Trip name").fill("Our big adventure");
  await page.getByLabel("Start date", { exact: true }).fill("2027-01-01");
  await page.getByLabel("End date", { exact: true }).fill("2027-12-31");
  await page.getByRole("button", { name: "Save settings" }).click();
  // Add out of chronological order to verify the default date sort.
  for (const index of [3, 0, 4, 1, 2]) {
    const place = places[index];
    await page.getByLabel("Where to next?").fill(place.name);
    await page.getByRole("button", { name: `${place.name} ${place.label}` }).click();
    await page.getByLabel("Arrive", { exact: true }).fill(`2027-0${index + 1}-01`);
    await page.getByLabel("Depart", { exact: true }).fill(`2027-0${index + 1}-05`);
    await page.getByRole("button", { name: "Add to my trip" }).click();
  }
  await expect(page.locator(".stop-card")).toHaveCount(5);
  await expect(page.locator(".stop-title strong")).toHaveText(places.map(p => p.name));
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".stop-card")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Our big adventure" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("loose-girl-trip:v1")!));
  expect(stored.stops.map((s: { arriveDate: string }) => s.arriveDate)).toEqual(["2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01", "2027-05-01"]);
  await page.getByRole("button", { name: "Drag Portland to reorder" }).dragTo(page.locator(".stop-card").first());
  await expect(page.locator(".stop-title strong").first()).toHaveText("Portland");
  await page.reload();
  await expect(page.locator(".stop-title strong").first()).toHaveText("Portland");
  await page.getByRole("button", { name: "Edit Denver", exact: true }).click();
  await page.getByLabel("Stop name").fill("Denver base camp");
  await page.getByLabel("Depart", { exact: true }).fill("2027-01-08");
  await page.getByRole("button", { name: "Save stop" }).click();
  await expect(page.locator(".stop-card").filter({ hasText: "Denver base camp" }).locator(".nights")).toContainText("7");
  await page.getByRole("button", { name: "Delete Austin", exact: true }).click();
  await page.getByRole("button", { name: "Move Phoenix up", exact: true }).click();
  await page.reload();
  await expect(page.locator(".stop-title strong")).toHaveText(["Portland", "Phoenix", "Denver base camp", "Savannah"]);
  await page.getByRole("button", { name: "Sort by date" }).click();
  await expect(page.locator(".stop-title strong")).toHaveText(["Denver base camp", "Phoenix", "Savannah", "Portland"]);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".sidebar-content").evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: "test-results/planner-desktop.png", fullPage: true });
});

test("search errors display, short queries do not fetch and date errors prevent saving", async ({ page }) => {
  let count = 0;
  await page.route("**/api/geocode?*", async route => {
    count++;
    await route.fulfill({ status: 429, json: { error: "Place search is busy. Wait a moment and try again." } });
  });
  await page.goto("/");
  await page.getByLabel("Where to next?").fill("D");
  await page.waitForTimeout(400);
  expect(count).toBe(0);
  await page.getByLabel("Where to next?").fill("Denver");
  await expect(page.locator(".error[role=alert]")).toContainText("Place search is busy");
  await page.unroute("**/api/geocode?*");
  await page.route("**/api/geocode?*", route => route.fulfill({ json: { places: [places[0]] } }));
  await page.getByLabel("Where to next?").fill("Denver CO");
  await page.getByRole("button", { name: "Denver Denver, CO, USA" }).click();
  await page.getByLabel("Arrive", { exact: true }).fill("2027-06-05");
  await page.getByLabel("Depart", { exact: true }).fill("2027-06-01");
  await page.getByRole("button", { name: "Add to my trip" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("Departure must be on or after arrival");
  await expect(page.locator(".stop-card")).toHaveCount(0);
});

test("corrupt saved data is preserved, and mobile controls fit the viewport", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loose-girl-trip:v1", "broken-json"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("left untouched");
  expect(await page.evaluate(() => localStorage.getItem("loose-girl-trip:v1"))).toBe("broken-json");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByLabel("Where to next?")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/planner-mobile.png", fullPage: true });
});

test("the real server route rejects invalid queries", async ({ request }) => {
  const response = await request.get("/api/geocode?q=x");
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Search must be between 2 and 120 characters." });
});
