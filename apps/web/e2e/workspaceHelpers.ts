import { expect, type Page } from '@playwright/test'
export async function workspaceLink(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1505) > 800) {
    await page.getByRole('navigation', { name: 'Community workspace', exact: true }).getByRole('link', { name, exact: true }).click()
  } else if (name === 'Inbox' || name === 'Dashboard') {
    await page.getByRole('navigation', { name: 'Mobile workspace', exact: true }).getByRole('link', { name, exact: true }).click()
  } else {
    const menu = ['My donations', 'Find food', 'My exchanges', 'Deliveries'].includes(name) ? 'Tasks' : 'More'
    await page.getByRole('navigation', { name: 'Mobile workspace', exact: true }).getByRole('button', { name: menu, exact: true }).click()
    await page.getByRole('dialog').getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  }
}
