import { expect, test } from "@playwright/test";

test("public screen uses the real API and its role navigation survives refresh", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const community = await request.get("/api/v1/community");
  expect(community.ok()).toBeTruthy();
  expect((await community.json()).data.roles).toHaveLength(3);
  const readiness = await request.get("/api/v1/health/ready");
  expect(readiness.status()).toBe(200);
  expect((await readiness.json()).data.status).toBe("ready");
  await page.goto("/");
  await expect(page).toHaveTitle("Second Table · Food shared locally");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Good food.Better shared.",
  );
  await expect(page.getByRole("tab", { name: "Donors" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Receivers" }).click();
  await expect(page).toHaveURL("/community/receiver");
  await expect(page.getByRole("tabpanel")).toContainText("fits your capacity");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Receivers" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Volunteers" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Help close the distance.",
  );
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("offline community request can be retried", async ({ page }) => {
  await page.route("**/api/v1/community", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("couldn’t load");
  await page.unroute("**/api/v1/community");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("tab", { name: "Donors" })).toBeVisible();
});

test("expanded homepage has working FAQ and a theme that persists across refresh and routes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator(".hero-photo")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A little closer. A lot less waste." }),
  ).toBeVisible();
  await page
    .getByText("How close does food need to be?", { exact: true })
    .click();
  await expect(
    page
      .locator(".home-faq details")
      .filter({ hasText: "How close does food need to be?" }),
  ).toHaveAttribute("open", "");
  await expect(
    page.getByText(/a maximum of 5 km from your saved location/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: info.outputPath("home-dark.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/");
  await page.screenshot({
    path: info.outputPath("home-light.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(await page.locator("[placeholder]").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("theme follows the device until a preference is selected", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
