import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

test('organizer imports, sells, recovers, re-auctions and exports a reconciled final workbook', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Journey Organizer');
  await page
    .getByLabel('Email', { exact: true })
    .fill(crypto.randomUUID() + '@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('Journey password 2026!');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await page.getByRole('link', { name: 'Create auction', exact: true }).click();
  await page
    .getByLabel('Auction name', { exact: true })
    .fill('Final Journey Cup');
  await page.getByLabel('Sport', { exact: true }).fill('Cricket');
  await page
    .getByRole('button', { name: 'Create auction', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Final Journey Cup' }),
  ).toBeVisible();
  const base = new URL(page.url()).pathname.replace('/overview', '');
  await page.goto(base + '/import');
  await expect(page.getByLabel('Spreadsheet')).toBeEnabled();
  await page.getByLabel('Spreadsheet').setInputFiles({
    name: 'players.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Name,Registration,Private phone\nPlayer Alpha,A1,private\nPlayer Beta,B1,private',
    ),
  });
  await page.getByLabel('name (required)', { exact: true }).selectOption('0');
  await page.getByLabel('registrationId', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Preview mapping' }).click();
  await expect(
    page.getByText('2 valid / 0 invalid.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(
    page.getByText('2 players imported;', { exact: false }),
  ).toBeVisible();
  await page.goto(base + '/teams');
  await page.getByLabel('Team name', { exact: true }).fill('Journey Royals');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Journey Royals' }),
  ).toBeVisible();
  await page.goto(base + '/live');
  await expect(page.getByText('Live connection active')).toBeVisible();
  const spectator = await context.newPage();
  await spectator.goto(base + '/live');
  await page
    .getByRole('button', { name: 'Start auction', exact: true })
    .click();
  await expect(
    spectator.getByRole('button', { name: 'Spin next player' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Spin next player' }).click();
  await expect(
    page.getByRole('button', { name: 'Mark SOLD', exact: true }),
  ).toBeEnabled();
  const selected = await page.locator('[aria-live="polite"] h2').textContent();
  await page.reload();
  await expect(page.locator('[aria-live="polite"] h2')).toHaveText(selected!);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByText('Live connection active')).toBeVisible();
  await page.screenshot({
    path: '.cache/phase6-live-projector.png',
    caret: 'initial',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.cache/phase6-live-mobile.png',
    caret: 'initial',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Mark SOLD', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mark SOLD', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Mark SOLD', exact: true }).click();
  await page.getByLabel('Final amount (INR)').fill('2000');
  await page
    .getByLabel('Purchasing team')
    .selectOption({ label: 'Journey Royals / 1,00,000 remaining / 15 slots' });
  await page.getByRole('button', { name: 'Confirm SOLD', exact: true }).click();
  // Auto-next must select the other player through the real API.
  await expect(
    page.getByRole('button', { name: 'Mark UNSOLD', exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('[aria-live="polite"] h2')).not.toHaveText(
    selected!,
  );
  await page
    .getByRole('button', { name: 'Pause auction', exact: true })
    .click();
  await page.getByRole('button', { name: 'Mark UNSOLD', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm UNSOLD', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Round finished', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Spin next player' }),
  ).toBeDisabled();
  await page.goto(base + '/unsold');
  await page
    .getByRole('button', { name: 'Begin unsold round', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(page).toHaveURL(/live/);
  const resume = page.getByRole('button', { name: 'Resume auction' });
  if (await resume.isVisible()) await resume.click();
  const spin = page.getByRole('button', { name: 'Spin next player' });
  if (await spin.isEnabled()) await spin.click();
  await expect(
    page.getByRole('button', { name: 'Mark SOLD', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mark SOLD', exact: true }).click();
  await page.getByLabel('Final amount (INR)').fill('1000');
  await page.getByLabel('Purchasing team').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Confirm SOLD', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Round finished', exact: true }),
  ).toBeVisible();
  await page.goto(base + '/results');
  await expect(
    page.getByText('R1: UNSOLD / R2: SOLD', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Complete auction', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(page.getByText('FINAL / INR', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download/ }).click();
  const file = await download;
  const path = await file.path();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(path!)) as unknown as ExcelJS.Buffer,
  );
  expect(workbook.worksheets.map((sheet) => sheet.name)).toHaveLength(6);
  expect(
    JSON.stringify(workbook.getWorksheet('Summary')!.getSheetValues()),
  ).toContain('FINAL');
  expect(
    JSON.stringify(workbook.getWorksheet('Summary')!.getSheetValues()),
  ).toContain('3000');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.cache/phase6-results-mobile.png',
    caret: 'initial',
    fullPage: true,
  });
  await spectator.close();
});
