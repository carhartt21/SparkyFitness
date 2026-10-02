import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.XOT_VISUAL_URL ?? 'http://localhost:8080';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('This review requires an isolated loopback demo server.');
const out =
  process.env.XOT_VISUAL_OUTPUT ?? '../.visual-sample/captures/meal-icons';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await context.route('**/api/version/latest-github', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ isNewVersionAvailable: false }),
    })
  );
  await context.route('**/api/announcement/current**', (r) =>
    r.fulfill({ contentType: 'application/json', body: 'null' })
  );
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.tsqd-parent-container{display:none!important}';
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();
  await page.goto(base + '/login');
  await page.getByRole('button', { name: /Explore Live Demo/ }).click();
  await page.locator('#demo-terms-checkbox').check();
  await page.getByRole('button', { name: /I Agree & Enter Demo/ }).click();
  await page.waitForURL((u) => u.pathname != '/login');
  await page.evaluate(() => {
    localStorage.setItem('i18nextLng', 'de');
    localStorage.setItem('xot-upstream-release-banner-dismissed', 'true');
    localStorage.setItem('sparkyfit_last_viewed_version', '1.7.2');
  });
  await page.request.post(base + '/api/user-preferences', {
    data: { language: 'de' },
  });
  await page.goto(base + '/settings?section=custom-meals');
  const section = page.getByRole('button', { name: /Eigene Mahlzeiten/ });
  await section.waitFor();
  const add = page.getByRole('button', {
    name: 'Kategorie hinzufügen',
    exact: true,
  });
  await add.click();
  let dialog = page.getByRole('dialog');
  await dialog
    .locator('input:not([type=radio]):not([type=time])')
    .fill('Synthetic icon meal');
  await dialog.getByRole('radio', { name: 'Getränk', exact: true }).check();
  await dialog.screenshot({ path: out + '/meal-icon-picker-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: out + '/meal-icon-picker-390.png' });
  const createdResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/meal-types') &&
      r.request().method() === 'POST' &&
      r.status() === 201
  );
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  const created = await (await createdResponse).json();
  const get = async () =>
    (await page.request.get(base + '/api/meal-types/' + created.id)).json();
  if ((await get()).icon_key !== 'water')
    throw Error('Create did not persist icon');
  await page.reload();
  await page.getByRole('button', { name: /Eigene Mahlzeiten/ }).waitFor();
  await page
    .getByRole('button', {
      name: 'Bearbeiten Sie Synthetic icon meal',
      exact: true,
    })
    .click();
  dialog = page.getByRole('dialog');
  if (
    !(await dialog
      .getByRole('radio', { name: 'Getränk', exact: true })
      .isChecked())
  )
    throw Error('Reload lost icon');
  await dialog
    .getByRole('radio', { name: 'Lebensmittel', exact: true })
    .check();
  const updatedResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/meal-types/' + created.id) &&
      r.request().method() === 'PUT' &&
      r.status() === 200
  );
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await updatedResponse;
  if ((await get()).icon_key !== 'food')
    throw Error('Edit did not persist icon');
  const omitted = await page.request.put(
    base + '/api/meal-types/' + created.id,
    { data: { default_time: '18:30' } }
  );
  if (omitted.status() !== 200 || (await get()).icon_key !== 'food')
    throw Error('Unrelated edit wiped icon');
  const invalid = await page.request.put(
    base + '/api/meal-types/' + created.id,
    { data: { icon_key: '<svg/>' } }
  );
  if (invalid.status() !== 400 || (await get()).icon_key !== 'food')
    throw Error('Invalid icon accepted or changed saved data');
  await page
    .getByRole('button', {
      name: 'Bearbeiten Sie Synthetic icon meal',
      exact: true,
    })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Standardsymbol verwenden', exact: true })
    .click();
  const reset = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/meal-types/' + created.id) &&
      r.request().method() === 'PUT' &&
      r.status() === 200
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await reset;
  if ((await get()).icon_key !== null) throw Error('Reset did not clear icon');
  await page.request.delete(base + '/api/meal-types/' + created.id);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1
  );
  if (overflow) throw Error('Page overflows horizontally');
  const result = {
    synthetic: true,
    create: true,
    reload: true,
    edit: true,
    omittedPreserves: true,
    invalidRejected: true,
    reset: true,
    horizontalOverflow: false,
  };
  writeFileSync(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
