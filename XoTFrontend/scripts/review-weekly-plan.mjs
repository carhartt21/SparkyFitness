import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.XOT_VISUAL_URL ?? 'http://localhost:8080';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('This review requires an isolated loopback demo server.');
const out =
  process.env.XOT_VISUAL_OUTPUT ?? '../.visual-sample/captures/weekly-plan';
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
  await page.goto(base + '/exercises');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: out + '/library-before.png', fullPage: true });
  const add = page.getByRole('button', { name: /Plan hinzufügen|Add Plan/ });
  await add.scrollIntoViewIfNeeded();
  await add.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.locator('#planName').fill('Synthetic activity week');
  const addSession = dialog
    .getByRole('button', { name: /Einheit hinzufügen|Add session/ })
    .first();
  await addSession.click();
  const type = dialog.locator('select').first();
  await type.selectOption('running');
  await dialog.locator('input[id$="-distance"]').first().fill('10');
  await dialog.locator('input[id$="-time"]').first().fill('07:30');
  await addSession.click();
  await dialog.locator('select').nth(1).selectOption('strength');
  await dialog.locator('input[id$="-duration"]').nth(1).fill('45');
  await dialog.locator('#planName').scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/planner-top-de-1280.png' });
  await dialog
    .locator('input[id$="-duration"]')
    .nth(1)
    .scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: out + '/planner-de-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: out + '/planner-de-390.png' });
  let failures = 0;
  await page.route('**/api/workout-plan-templates', async (route) => {
    if (route.request().method() === 'POST' && failures++ === 0)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic temporary failure' }),
      });
    else await route.continue();
  });
  const save = dialog.getByRole('button', { name: /Plan speichern|Save Plan/ });
  await save.click();
  await dialog
    .getByRole('alert')
    .filter({ hasText: /Der Plan konnte nicht gespeichert|could not be saved/ })
    .waitFor();
  if (
    (await dialog.locator('#planName').inputValue()) !==
    'Synthetic activity week'
  )
    throw Error('Failed save lost input');
  await dialog.screenshot({ path: out + '/save-error-retains-input.png' });
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/workout-plan-templates') &&
      r.request().method() === 'POST' &&
      r.status() === 201
  );
  await save.click();
  const created = await (await response).json();
  await dialog.waitFor({ state: 'hidden' });
  const read = await page.request.get(
    base + '/api/workout-plan-templates/' + created.id
  );
  const persisted = await read.json();
  if (
    persisted.assignments.length !== 2 ||
    persisted.assignments[0].planned_distance_km !== 10 ||
    persisted.assignments[1].planned_duration_minutes !== 45
  )
    throw Error('Plan round-trip mismatch');
  await page.reload();
  await page
    .locator('span:visible')
    .filter({ hasText: /^Synthetic activity week$/ })
    .first()
    .waitFor();
  await page.screenshot({ path: out + '/saved-week.png', fullPage: true });
  await page.request.delete(base + '/api/workout-plan-templates/' + created.id);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1
  );
  writeFileSync(
    out + '/result.json',
    JSON.stringify(
      {
        creation: true,
        persistenceAfterReload: true,
        failureRetainsInputs: true,
        targetsReconcile: true,
        horizontalOverflow: overflow,
        synthetic: true,
      },
      null,
      2
    )
  );
  console.log(
    'Weekly plan creation, save-error retention, reload persistence and targets passed.'
  );
} finally {
  await browser.close();
}
