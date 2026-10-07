import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { submitLogin } from "./workspaceHelpers";

async function login(page: Page, role: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`z1.${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DBTHON_E2E_PASSWORD!);
  await submitLogin(page);
  await expect(page).toHaveURL("/dashboard");
}
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}
async function advanced(page: Page) {
  if (!(await page.getByLabel("Latitude", { exact: true }).isVisible()))
    await page.locator(".advanced-location summary").click();
}

test("presets, repeat donations, quantity preview and keyboard location fallback work", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const started = Date.now();
  await login(page, "donor");
  await page.goto("/donations/new");
  const name = `Preset food ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Food name").fill(name);
  await page.getByLabel("Whole quantity (kg)").fill("4");
  await page
    .getByRole("button", { name: "Increase quantity by half a kilogram" })
    .click();
  await expect(page.locator(".listing-preview")).toContainText("4.50 kg");
  await page.getByRole("button", { name: "4 h", exact: true }).click();
  await expect(page.getByLabel("Prepared at")).toHaveCount(0);
  await advanced(page);
  await page.getByLabel("Latitude", { exact: true }).fill("12.969200");
  await page.getByLabel("Longitude", { exact: true }).fill("79.155900");
  await page
    .getByLabel("Food photo (optional)")
    .setInputFiles("public/images/food-handover-480.webp");
  await expect(page.getByText("Preparing photo…")).toHaveCount(0);
  await accessible(page);
  const create = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/listings") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish listing" }).click();
  const result = await create;
  expect(result.status()).toBe(201);
  const body = result.request().postDataJSON();
  expect(
    (Date.parse(body.expiry_window_end) -
      Date.parse(body.expiry_window_start)) /
      3600000,
  ).toBe(4);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".listing-photo-large")).toBeVisible();
  await page.getByRole("link", { name: "List again", exact: true }).click();
  await expect(page.getByLabel("Food name")).toHaveValue(name);
  await expect(page.getByLabel("Whole quantity (kg)")).toHaveValue("4.50");
  const repeatStarted = Date.now();
  const repeatCreate = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/listings") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish listing" }).click();
  const repeated = await repeatCreate;
  expect(repeated.status()).toBe(201);
  expect(
    (Date.parse(repeated.request().postDataJSON().expiry_window_end) -
      Date.parse(repeated.request().postDataJSON().expiry_window_start)) /
      3600000,
  ).toBe(2);
  console.log(
    `Scripted ${info.project.name} donor flow ${Date.now() - started} ms; repeat submission ${Date.now() - repeatStarted} ms. This is automation, not a participant usability study.`,
  );
});

test("maps lazy load, coordinate sync and tile failure retain usable fields", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await login(page, "donor");
  await page.goto("/donations/new");
  expect(await page.locator(".leaflet-container").count()).toBe(0);
  await page.getByRole("button", { name: "Choose on map" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(
    page.getByText("Map tiles could not load.", { exact: false }),
  ).toBeVisible();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 90, y: 100 } });
  const pin = await page.locator(".leaflet-marker-draggable").boundingBox();
  expect(pin).not.toBeNull();
  await page.mouse.move(pin!.x + pin!.width / 2, pin!.y + pin!.height / 2);
  await page.mouse.down();
  await page.mouse.move(pin!.x + 80, pin!.y + 60, { steps: 8 });
  await page.mouse.up();
  await advanced(page);
  const latitude = await page
    .getByLabel("Latitude", { exact: true })
    .inputValue();
  expect(latitude).not.toBe("12.969200");
  await page.getByLabel("Latitude", { exact: true }).fill("12.970000");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    "12.970000",
  );
  expect(errors).toEqual([]);
});

test("capacity, trust, list-map URL restoration, stale refresh and screenshots work", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await login(page, "receiver");
  await page.goto("/food");
  await expect(page.locator(".food-row").first()).toBeVisible();
  await expect(page.locator(".food-list")).toContainText("Verified donor");
  await expect(
    page.getByText("Sorted by collection deadline, then distance.", {
      exact: false,
    }),
  ).toBeVisible();
  const ids = await page
    .locator(".food-row")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-listing-id")),
    );
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(
    await page
      .locator(".food-row")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-listing-id")),
      ),
  ).toEqual(ids);
  await page
    .getByRole("button", { name: "Show on map", exact: true })
    .first()
    .click();
  await expect(page.locator(".food-row.selected")).toHaveCount(1);
  await expect(page.locator(".map-card")).toBeVisible();
  await page.reload();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("food-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("food-dark.png"),
    fullPage: true,
  });
  await page.route("**/api/v1/listings?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Synthetic refresh failure" } }),
    }),
  );
  await page.getByRole("button", { name: "Refresh view", exact: true }).click();
  await expect(
    page.getByText("Couldn’t update — showing the last loaded view"),
  ).toBeVisible();
  expect(await page.locator(".food-row").count()).toBe(ids.length);
  await page.unroute("**/api/v1/listings?**");
  await page.getByRole("button", { name: "Retry update", exact: true }).click();
  await expect(
    page.getByText("Couldn’t update — showing the last loaded view"),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "View food", exact: true })
    .first()
    .click();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("food-detail-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: info.outputPath("food-detail-light.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("link", { name: "Share on WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/\?text=/);
});

test("homepage and admin charts are accessible; report filters survive refresh", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Shared this month" }),
  ).toBeVisible();
  await expect(
    page.getByText("Prototype totals include synthetic demo data.", {
      exact: false,
    }),
  ).toBeVisible();
  await accessible(page);
  await login(page, "admin");
  await page.goto("/admin/impact");
  await expect(
    page.getByText("Median time to claim", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Group by").selectOption("zone");
  await expect(page).toHaveURL(/grouping=zone/);
  await page.reload();
  await expect(page.getByLabel("Group by")).toHaveValue("zone");
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("impact-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("impact-dark.png"),
    fullPage: true,
  });
});
