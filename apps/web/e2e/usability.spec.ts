import { expect, test, type Page } from "@playwright/test";
import { submitLogin, workspaceLink } from "./workspaceHelpers";
async function login(page: Page, role: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`z1.${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DBTHON_E2E_PASSWORD!);
  await submitLogin(page);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}

test("dashboard menus, help, search and browser history provide working destinations", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "receiver");
  await expect(page).toHaveURL("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Your dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-summary")).toBeVisible();
  const data = (
    await (await page.request.get("/api/v1/workspace/overview")).json()
  ).data;
  await expect(
    page
      .locator(".dashboard-summary > div")
      .filter({ hasText: "Unread updates" })
      .locator("dd"),
  ).toHaveText(String(data.unread_count));
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("dashboard-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: info.outputPath("dashboard-dark.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Second Table home" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "My donations" }),
    ).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("mobile-menu.png") });
    await page.getByRole("button", { name: "Close menu" }).click();
  } else {
    const navigation = page.getByRole("navigation", {
      name: "Community workspace",
    });
    await expect(
      navigation.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await navigation.evaluate((element) => {
        const side = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll("a")).every(
          (link) => link.getBoundingClientRect().right <= side.right,
        );
      }),
    ).toBeTruthy();
  }
  await workspaceLink(page, "Find food");
  await page.getByLabel("Search food", { exact: true }).fill("bread");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=bread/);
  await expect(page.locator(".food-row").first()).toContainText("Bread");
  await page.getByLabel("Category", { exact: true }).selectOption("Veg");
  await expect(page).toHaveURL(/category=Veg/);
  await page.reload();
  await expect(page.getByLabel("Category")).toHaveValue("Veg");
  await expect(page.getByLabel("Search food")).toHaveValue("bread");
  const listUrl = page.url();
  await page
    .locator(".food-row")
    .first()
    .getByRole("link", { name: "View food" })
    .click();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Back to find food" })
    .click();
  await expect(page).toHaveURL(listUrl);
  await page.getByLabel("Search radius").selectOption("1000");
  await expect(page).toHaveURL(/radius_m=1000/);
  await page.goBack();
  await expect(page.getByLabel("Search radius")).toHaveValue("5000");
  await page.goForward();
  await expect(page.getByLabel("Search radius")).toHaveValue("1000");
  await workspaceLink(page, "Help");
  await page.getByLabel("Search help").fill("15-minute");
  await page.getByRole("button", { name: "Search answers" }).click();
  await expect(page.locator(".help-faq details")).toHaveCount(1);
  await page
    .getByText("What happens if a collection is missed?", { exact: true })
    .click();
  await expect(page.locator(".help-faq details")).toHaveAttribute("open");
  await expect(
    page.getByRole("link", { name: "Find nearby food", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("help.png"), fullPage: true });
  await noOverflow(page);
  await page.getByLabel("Search help").fill("x".repeat(80));
  await page.getByRole("button", { name: "Search answers" }).click();
  await expect(
    page.getByText("No answers match that search.", { exact: false }),
  ).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("real food pagination retains filters and supports previous and direct-link recovery", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await login(page, "donor");
  await expect(page).toHaveURL("/dashboard");
  const session = (
    await (await page.request.get("/api/v1/auth/session")).json()
  ).data;
  const q = `Navigation meal ${info.project.name}`;
  const now = Date.now();
  for (let index = 0; index < 23; index++) {
    const response = await page.request.post("/api/v1/listings", {
      headers: {
        "X-Requested-With": "SecondTable",
        "X-CSRF-Token": session.csrf_token,
        "Idempotency-Key": `nav-${info.project.name}-${now}-${index}`,
      },
      data: {
        food_type: `${q} ${index} ${"x".repeat(50)}`,
        category: "Veg",
        quantity_kg: "1.00",
        prepared_at: new Date(now - 3600000).toISOString(),
        expiry_window_start: new Date(now - 60000).toISOString(),
        expiry_window_end: new Date(now + 7200000).toISOString(),
        pickup_lat: "12.969200",
        pickup_long: "79.155900",
      },
    });
    expect(response.status()).toBe(201);
  }
  await workspaceLink(page, "My donations");
  await page.getByLabel("Search food").fill(q);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(20);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".food-row")).toHaveCount(3);
  const nextUrl = page.url();
  await page.reload();
  await expect(page.locator(".food-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator(".food-row")).toHaveCount(20);
  await page.goBack();
  await expect(page).toHaveURL(nextUrl);
  await expect(page.locator(".food-row")).toHaveCount(3);
  const isolated = await page.context().newPage();
  await isolated.goto(nextUrl);
  await expect(
    isolated.getByRole("button", { name: "Previous page" }),
  ).toHaveCount(0);
  await isolated.getByRole("button", { name: "Back to first page" }).click();
  await expect(isolated.locator(".food-row")).toHaveCount(20);
  await isolated.close();
  await noOverflow(page);
});

test("deep links survive login and overview failures recover without displaying fabricated counts", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto("/food?q=bread&category=Veg");
  await expect(page).toHaveURL("/sign-in");
  await submitLogin(page, "receiver");
  await expect(page).toHaveURL("/food?q=bread&category=Veg");
  await page.route("**/api/v1/workspace/overview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Synthetic overview outage" } }),
    }),
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic overview outage",
  );
  await expect(page.locator(".dashboard-summary")).toHaveCount(0);
  await expect(page.locator(".unread-badge:visible")).toHaveCount(0);
  await page.unroute("**/api/v1/workspace/overview");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".dashboard-summary")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
