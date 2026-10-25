import { expect, test } from '@playwright/test';
test('workspace displays verified infrastructure status', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Great teams start with a great auction.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'API and MongoDB connected',
  );
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'API and MongoDB connected',
  );
});
test('workspace fits a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
