import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Checks persisted cart editing and accessibility. */
test('guest adds, edits, reloads and removes a persisted cart item', async ({ page }) => {
  await page.goto('/cart#access=demo-table-1');
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart: Pasta', exact: true }).click();
  await page.getByLabel('Servings').fill('2');
  await page.getByLabel('Parmesan').fill('2');
  await page.getByLabel('Note (optional').fill('No salt');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Total: €31.00')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Note: No salt')).toBeVisible();
  await page.getByRole('button', { name: 'Edit Pasta', exact: true }).click();
  await page.getByLabel('Servings').fill('3');
  await page.getByLabel('Parmesan').fill('0');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Total: €37.50')).toBeVisible();
  await page.getByRole('button', { name: 'Check cart', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your cart is valid');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Remove Pasta', exact: true }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check cart', exact: true })).toBeDisabled();
});

/** Checks isolation and invalid-token rejection in the browser. */
test('table sessions stay separate and invalid access cannot reveal a cart', async ({
  page,
  browser,
}) => {
  await page.goto('/cart#access=demo-table-1');
  await page.getByRole('button', { name: 'Add to cart: Mineralwasser', exact: true }).click();
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Total: €3.20')).toBeVisible();
  const other = await browser.newContext();
  try {
    const guest = await other.newPage();
    await guest.goto('http://127.0.0.1:4200/cart#access=demo-table-2');
    await expect(guest.getByText('Your cart is empty.')).toBeVisible();
    await guest.goto('http://127.0.0.1:4200/cart#access=revoked');
    await expect(guest.getByRole('alert')).toContainText('Invalid or expired guest access');
    await expect(guest.getByRole('button', { name: 'Check cart', exact: true })).toHaveCount(0);
  } finally {
    await other.close();
  }
  await page.getByRole('button', { name: 'Remove Mineralwasser', exact: true }).click();
});

/** Checks mobile layout, limits, focus and accessibility. */
test('mobile cart has accessible controls, validates limits and fits the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cart#access=demo-table-2');
  await page.getByRole('button', { name: 'Add to cart: Pasta', exact: true }).click();
  await page.getByLabel('Parmesan').fill('3');
  await expect(page.getByRole('button', { name: 'Save item' })).toBeDisabled();
  await page.getByLabel('Parmesan').fill('1');
  await expect(page.getByRole('button', { name: 'Save item' })).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/cart-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to cart: Pasta', exact: true })).toBeFocused();
});
