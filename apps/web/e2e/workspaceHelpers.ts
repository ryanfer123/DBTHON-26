import { expect, type Page } from "@playwright/test";
export async function submitLogin(page: Page, role?: string) {
  const email = role
    ? `z1.${role}@example.invalid`
    : await page.getByLabel("Email address").inputValue();
  const password = role
    ? process.env.DBTHON_E2E_PASSWORD!
    : await page.getByLabel("Password", { exact: true }).inputValue();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/auth/login"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const response = await responsePromise;
    if (response.status() !== 429) return;
    await expect(page.getByRole("alert")).toContainText("Too many attempts");
    const retryAfter = Number(response.headers()["retry-after"]);
    await page.waitForTimeout(
      (Number.isFinite(retryAfter) ? retryAfter : 0) * 1000 + 1000,
    );
  }
  throw new Error(
    "Login remained throttled after five advertised retry windows",
  );
}

export async function workspaceLink(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1505) > 800) {
    await page
      .getByRole("navigation", { name: "Community workspace", exact: true })
      .getByRole("link", { name, exact: true })
      .click();
  } else if (name === "Inbox" || name === "Dashboard") {
    await page
      .getByRole("navigation", { name: "Mobile workspace", exact: true })
      .getByRole("link", { name, exact: true })
      .click();
  } else {
    const menu = [
      "My donations",
      "Food requests",
      "Find food",
      "My exchanges",
      "Deliveries",
    ].includes(name)
      ? "Tasks"
      : "More";
    await page
      .getByRole("navigation", { name: "Mobile workspace", exact: true })
      .getByRole("button", { name: menu, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
}
