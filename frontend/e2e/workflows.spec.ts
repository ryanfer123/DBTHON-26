import { expect, test, type Page } from "@playwright/test";
import { submitLogin, workspaceLink } from "./workspaceHelpers";

function localTime(time: number) {
  const value = new Date(time);
  return new Date(time - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
async function signIn(page: Page, role: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`z1.${role}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DBTHON_E2E_PASSWORD!);
  await submitLogin(page);
  await expect(page).toHaveURL("/dashboard");
}
async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(await page.locator("[placeholder]").count()).toBe(0);
}

test("food reaches a receiver through real listing, claim, assignment, delivery, rating and report screens", async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const food = `Browser vegetables ${info.project.name} ${Date.now()}`;
  await signIn(page, "donor");
  await workspaceLink(page, "My donations");
  await page.getByRole("link", { name: "List food", exact: true }).click();
  await page.getByLabel("Food name").fill(food);
  await page.getByLabel("Whole quantity (kg)").fill("4.00");
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByLabel("Prepared at").fill(localTime(Date.now() - 3600000));
  await page.getByLabel("Collection opens").fill(localTime(Date.now() - 60000));
  await page
    .getByLabel("Collect by", { exact: true })
    .fill(localTime(Date.now() + 7200000));
  if (!(await page.getByLabel("Latitude", { exact: true }).isVisible()))
    await page.locator(".advanced-location summary").click();
  await page.getByLabel("Latitude", { exact: true }).fill("12.969200");
  await page.getByLabel("Longitude", { exact: true }).fill("79.155900");
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("listing-form.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish listing" })
    .click({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: food, exact: true }),
  ).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy listing link" }).click();
  await expect(page.getByRole("status")).toContainText("Listing link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  );
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Synthetic denied clipboard");
    };
  });
  await page.getByRole("button", { name: "Copy listing link" }).click();
  await expect(page.getByLabel("Listing link", { exact: true })).toHaveValue(
    page.url(),
  );
  await page.getByRole("link", { name: "Edit listing" }).click();
  await page.getByLabel("Whole quantity (kg)").fill("4.50");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(
    page.getByText("4.50 kg · Vegetarian", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await signOut(page);

  await signIn(page, "receiver");
  await workspaceLink(page, "Find food");
  await page.getByLabel("Search food").fill(food);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const row = page.locator(".food-row").filter({ hasText: food });
  await expect(row).toBeVisible();
  await page.screenshot({
    path: info.outputPath("food-feed.png"),
    fullPage: true,
  });
  await noOverflow(page);
  await row.getByRole("link", { name: "View food" }).click();
  await page.getByRole("button", { name: "Claim 4.50 kg" }).click();
  await expect(
    page.getByRole("heading", { name: food, exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/claims\/\d+$/);
  // The single confirmed claim continues through assignment and delivery below;
  // backend integration tests cover cancellation and subsequent reallocation.
  const claimPath = new URL(page.url()).pathname;
  await expect(
    page.getByText("4.50 kg · Confirmed", { exact: true }),
  ).toBeVisible();
  const whatsapp = page.locator('a[href^="https://wa.me/"]').first();
  await expect(whatsapp).toBeVisible();
  expect(
    new URL((await whatsapp.getAttribute("href"))!).searchParams.get("text"),
  ).toContain("NomNom exchange #");
  await workspaceLink(page, "Dashboard");
  await page
    .locator(".dashboard-list li")
    .filter({ hasText: food })
    .getByRole("link", { name: "Open exchange" })
    .click();
  await expect(page).toHaveURL(claimPath);
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Back to my exchanges" })
    .click();
  await expect(page).toHaveURL("/claims?status=Confirmed");
  await page.reload();
  await expect(page.getByLabel("Claim status")).toHaveValue("Confirmed");
  await signOut(page);

  await signIn(page, "volunteer");
  await workspaceLink(page, "Deliveries");
  const task = page.locator(".task-row").filter({ hasText: food });
  await task.getByRole("button", { name: "Arrange collection" }).click();
  await task.getByLabel("Collection time").fill(localTime(Date.now() + 300000));
  await task.getByRole("button", { name: "Accept delivery" }).click();
  await expect(page.getByLabel("Show deliveries")).toHaveValue("mine");
  let assignment = page.locator(".assignment-row").filter({ hasText: food });
  await expect(assignment).toHaveCount(1);
  await assignment.getByRole("button", { name: "Cancel assignment" }).click();
  await assignment
    .getByLabel("Reason for this action")
    .fill("Synthetic test: replacement attempt.");
  await assignment
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(
    assignment.getByRole("heading", { name: `${food} · Cancelled` }),
  ).toBeVisible();
  await page.getByLabel("Show deliveries").selectOption("tasks");
  await task.getByRole("button", { name: "Arrange collection" }).click();
  await task.getByLabel("Collection time").fill(localTime(Date.now() + 300000));
  await task.getByRole("button", { name: "Accept delivery" }).click();
  await page.getByLabel("Assignment status").selectOption("Scheduled");
  assignment = page.locator(".assignment-row").filter({ hasText: food });
  await assignment.getByRole("button", { name: "Record pickup" }).click();
  await page.getByLabel("Assignment status").selectOption("PickedUp");
  await expect(
    assignment.getByRole("heading", { name: `${food} · PickedUp` }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Assignment status")).toHaveValue("PickedUp");
  await expect(page.getByLabel("Show deliveries")).toHaveValue("mine");
  await workspaceLink(page, "Dashboard");
  await page
    .locator(".dashboard-list li")
    .filter({ hasText: food })
    .getByRole("link", { name: "Open delivery" })
    .click();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Back to deliveries" })
    .click();
  await expect(page).toHaveURL("/deliveries?view=mine");
  await expect(
    assignment.getByRole("heading", { name: `${food} · PickedUp` }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("delivery.png"),
    fullPage: true,
  });
  await noOverflow(page);
  await assignment.getByRole("button", { name: "Confirm delivery" }).click();
  await page.getByLabel("Assignment status").selectOption("Delivered");
  await expect(
    assignment.getByRole("heading", { name: `${food} · Delivered` }),
  ).toBeVisible();
  await signOut(page);

  await signIn(page, "receiver");
  await page.goto(claimPath);
  await expect(
    page.getByText("4.50 kg · Completed", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page
    .getByLabel("Comments (optional)")
    .fill("Synthetic test: completed handover.");
  await page.getByRole("button", { name: "Submit rating" }).click();
  await expect(page.getByText("Your rating: 5 / 5")).toBeVisible();
  await workspaceLink(page, "Inbox");
  await expect(page.locator(".inbox-row").first()).toBeVisible();
  const unread = page.locator(".inbox-row.unread").first();
  const message = await unread.locator("h2").innerText();
  await unread.getByRole("button", { name: "Mark read" }).click();
  await expect(
    page.locator(".inbox-row").filter({ hasText: message }).first(),
  ).toContainText("Read");
  const overview = (
    await (await page.request.get("/api/v1/workspace/overview")).json()
  ).data;
  await expect(page.locator(".unread-badge:visible")).toHaveText(
    ` (${overview.unread_count})`,
  );
  await workspaceLink(page, "My trust");
  await expect(page.locator(".ledger-list")).toContainText("pickup · deliver");
  await page.getByRole("button", { name: "Verify my complete chain" }).click();
  await expect(
    page.getByText(/Internal consistency checked independently/),
  ).toBeVisible();
  await noOverflow(page);
  await signOut(page);

  await signIn(page, "donor");
  await page.goto(claimPath);
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Submit rating" }).click();
  await expect(page.getByText("Your rating: 4 / 5")).toBeVisible();
  await signOut(page);
  await signIn(page, "admin");
  await workspaceLink(page, "Impact report");
  await expect(
    page.getByRole("region", { name: "Impact details" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByLabel("Group by").selectOption("zone");
  await expect(page.locator(".report-table tbody tr")).toHaveCount(1);
  const delivered = page
    .locator(".impact-summary > div")
    .filter({ hasText: "Food delivered" })
    .locator("dd");
  const kilograms = Number(
    (await delivered.innerText()).replace("kg", "").trim(),
  );
  expect(kilograms).toBeGreaterThanOrEqual(4.5);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nomnom-impact.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("delivered_kg");
  expect(csv).toContain(kilograms.toFixed(2));
  await page.screenshot({
    path: info.outputPath("impact.png"),
    fullPage: true,
  });
  await noOverflow(page);
  await workspaceLink(page, "Exchange review");
  await page.getByLabel("Claim status").selectOption("Completed");
  await expect(
    page.locator(".exchange-row").filter({ hasText: food }),
  ).toBeVisible();
  await page.goto("/admin/users/102/audit");
  await expect(page.locator(".ledger-list")).toContainText("rating · create");
  expect(errors).toEqual([]);
});

test("feed failures recover, denied roles show verification guidance, and invalid report dates do not request exports", async ({
  page,
}) => {
  test.setTimeout(150000);
  await signIn(page, "receiver");
  await page.route("**/api/v1/listings?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Synthetic temporary outage" },
      }),
    }),
  );
  await page.goto("/food");
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic temporary outage",
  );
  await page.unroute("**/api/v1/listings?**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/donations");
  await expect(page.getByText(/requires an approved Donor role/)).toBeVisible();
  await signOut(page);
  await signIn(page, "admin");
  await page.goto("/admin/impact");
  await page.getByLabel("From (UTC)").fill("2030-01-01");
  await expect(page.getByRole("alert")).toContainText("ordered date range");
  await expect(page.getByRole("button", { name: "Download CSV" })).toHaveCount(
    0,
  );
});
