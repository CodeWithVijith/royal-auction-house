import { test, expect } from '@playwright/test';
test('organizer registers, creates and edits an auction, reloads, signs out and signs in', async ({
  page,
}) => {
  const email = 'browser-' + crypto.randomUUID() + '@example.test';
  const password = 'Browser auction password 2026!';
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Browser Organizer');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'My auctions' }),
  ).toBeVisible();
  await expect(page.getByText('Your first auction starts here')).toBeVisible();
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === 'sports_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  await page.getByRole('link', { name: 'Create auction', exact: true }).click();
  await page
    .getByLabel('Auction name', { exact: true })
    .fill('Browser Premier League');
  await page.getByLabel('Sport', { exact: true }).fill('Cricket');
  await page.getByLabel('Denomination').selectOption('POINTS');
  await page
    .getByRole('button', { name: 'Create auction', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Browser Premier League' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('1,00,000 POINTS')).toBeVisible();
  await page.getByRole('link', { name: 'Edit settings' }).click();
  await page.getByLabel('Default team budget').fill('75000');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Auction settings saved.');
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page.getByText('75,000 POINTS')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My auctions' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Browser Premier League' }),
  ).toBeVisible();
  await page.screenshot({
    path: '.cache/phase1-dashboard.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: '.cache/phase1-mobile.png', fullPage: true });
});
test('another browser cannot read an organizer auction by URL', async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const a = await first.newPage();
    const b = await second.newPage();
    for (const [page, name] of [
      [a, 'A'],
      [b, 'B'],
    ] as const) {
      await page.goto('/register');
      await page.getByLabel('Your name').fill('Organizer ' + name);
      await page
        .getByLabel('Email', { exact: true })
        .fill(name + '-' + crypto.randomUUID() + '@example.test');
      await page
        .getByLabel('Password', { exact: true })
        .fill('Isolated browser password 2026!');
      await page
        .getByRole('button', { name: 'Create account', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'My auctions' }),
      ).toBeVisible();
    }
    await a.getByRole('link', { name: 'Create auction', exact: true }).click();
    await a
      .getByLabel('Auction name', { exact: true })
      .fill('Private browser auction');
    await a.getByLabel('Sport', { exact: true }).fill('Football');
    await a
      .getByRole('button', { name: 'Create auction', exact: true })
      .click();
    await expect(
      a.getByRole('heading', { name: 'Private browser auction' }),
    ).toBeVisible();
    await b.goto(a.url());
    await expect(
      b.getByRole('heading', { name: 'Auction not found' }),
    ).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});
