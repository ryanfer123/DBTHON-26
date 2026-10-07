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

test("food request offers, claims and pickup agreements follow the shared workflow", async ({
  page,
}) => {
  test.setTimeout(150000);
  const food = `Community request ${Date.now()}`;
  const listing = `Request offer ${Date.now()}`;

  await signIn(page, "receiver");
  await workspaceLink(page, "Food requests");
  await page.getByRole("link", { name: "Post a food need" }).click();
  await page.getByLabel("Food needed").fill(food);
  await page.getByLabel("Target quantity (kg)").fill("4.00");
  await page
    .getByLabel("Notes for donors")
    .fill("Community kitchen collection");
  await page.getByRole("button", { name: "Publish food request" }).click();
  await expect(page.getByRole("heading", { name: food })).toBeVisible();
  const requestId = Number(page.url().match(/\/requests\/(\d+)/)?.[1]);
  expect(requestId).toBeGreaterThan(0);

  await signOut(page);
  await signIn(page, "donor");
  await page.goto(`/donations/new?request_id=${requestId}`);
  await page.getByLabel("Food name").fill(listing);
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
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/requests/${requestId}\\?new_listing=`),
  );
  const select = page.getByLabel("Listing to offer");
  const listingId = Number(await select.inputValue());
  await page.getByRole("button", { name: "Offer listing" }).click();
  await expect(page.getByText("Listing offered.")).toBeVisible();

  await signOut(page);
  await signIn(page, "receiver");
  await page.goto(`/requests/${requestId}`);
  await page.getByRole("link", { name: "View offered listing" }).click();
  await page.getByRole("button", { name: "Claim 4.00 kg" }).click();
  await expect(page).toHaveURL(/\/claims\/\d+$/);
  const claimId = Number(page.url().match(/\/claims\/(\d+)$/)?.[1]);
  expect(listingId).toBeGreaterThan(0);

  await signOut(page);
  await signIn(page, "volunteer");
  await workspaceLink(page, "Deliveries");
  const acceptResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/claims/${claimId}/pickups`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Arrange collection" }).click();
  await page.getByLabel("Collection time").fill(localTime(Date.now() + 300000));
  await page.getByRole("button", { name: "Accept delivery" }).click();
  expect((await acceptResponse).status()).toBe(201);
  await page.goto(`/claims/${claimId}`);
  await expect(
    page.getByRole("heading", { name: "Awaiting pickup time agreements" }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, "donor");
  await page.goto(`/claims/${claimId}`);
  await page.getByRole("button", { name: "Agree to pickup time" }).click();
  await expect(page.getByText("Donor: Agreed")).toBeVisible();

  await signOut(page);
  await signIn(page, "receiver");
  await page.goto(`/claims/${claimId}`);
  await page.getByRole("button", { name: "Agree to pickup time" }).click();
  await expect(
    page.getByRole("heading", { name: "Pickup time agreed" }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, "donor");
  await page.goto(`/claims/${claimId}`);
  await page.getByRole("button", { name: "Propose another time" }).click();
  await page.getByLabel("New pickup time").fill(localTime(Date.now() + 600000));
  await page.getByRole("button", { name: "Send new time proposal" }).click();
  await expect(
    page.getByRole("heading", { name: "Awaiting pickup time agreements" }),
  ).toBeVisible();
  await expect(page.getByText("Donor: Agreed")).toBeVisible();
  await expect(page.getByText("Receiver: Awaiting agreement")).toBeVisible();
  await expect(page.getByText("Volunteer: Awaiting agreement")).toBeVisible();

  await signOut(page);
  await signIn(page, "receiver");
  await page.goto(`/claims/${claimId}`);
  await page.getByRole("button", { name: "Agree to pickup time" }).click();
  await expect(page.getByText("Receiver: Agreed")).toBeVisible();

  await signOut(page);
  await signIn(page, "volunteer");
  await page.goto(`/claims/${claimId}`);
  await page.getByRole("button", { name: "Agree to pickup time" }).click();
  await expect(
    page.getByRole("heading", { name: "Pickup time agreed" }),
  ).toBeVisible();
});

test("community suggestions need admin review before appearing as updates", async ({
  page,
}) => {
  await signIn(page, "receiver");
  await workspaceLink(page, "Community updates");
  const title = `Collection day ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Details", { exact: true })
    .fill("The community kitchen is collecting sealed dry goods this week.");
  await page
    .getByLabel("HTTPS resource link (optional)")
    .fill("https://example.com/collection");
  await page.getByRole("button", { name: "Submit suggestion" }).click();
  await expect(page.getByRole("status")).toContainText("Suggestion submitted");
  await page.getByText("My submitted suggestions").click();
  await expect(page.getByText(title)).toBeVisible();

  await signOut(page);
  await signIn(page, "admin");
  await workspaceLink(page, "Community publishing");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Publish suggestion" }).click();
  await expect(
    page.getByText("Community update saved.", { exact: true }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, "receiver");
  await page.goto("/community/updates");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
