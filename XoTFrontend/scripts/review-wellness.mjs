import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.XOT_VISUAL_URL ?? 'http://localhost:8080';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Wellness review requires an isolated loopback demo server.');
const out =
  process.env.XOT_VISUAL_OUTPUT ?? '../.visual-sample/captures/wellness';
mkdirSync(out, { recursive: true });
const date = '2026-10-01';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.route('**/api/version/latest-github', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: '{"isNewVersionAvailable":false}',
    })
  );
  await context.route('**/api/announcement/current**', (route) =>
    route.fulfill({ contentType: 'application/json', body: 'null' })
  );
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent =
        '.tsqd-parent-container{display:none!important}html,*{scroll-behavior:auto!important;animation:none!important;transition:none!important}';
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base + '/login');
  await page.getByRole('button', { name: /Explore Live Demo/ }).click();
  await page.locator('#demo-terms-checkbox').check();
  await page.getByRole('button', { name: /I Agree & Enter Demo/ }).click();
  await page.waitForURL((url) => url.pathname !== '/login');
  await page.request.post(base + '/api/user-preferences', {
    data: { language: 'de' },
  });
  const progress = await (
    await page.request.get(`${base}/api/v2/tracking/daily-progress/${date}`)
  ).json();
  const activitiesBefore = await (
    await page.request.get(
      `${base}/api/v2/tracking/habits?include_inactive=true`
    )
  ).json();
  const existingIds = new Set(activitiesBefore.map((activity) => activity.id));

  await page.goto(`${base}/diary?date=${date}`);
  const card = page.getByTestId('wellness-card');
  await card
    .getByRole('button', { name: 'Sauna erfassen', exact: true })
    .click();
  await card
    .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
    .waitFor();
  await page.reload();
  await card
    .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
    .waitFor();
  results.push('preset persists after reload on selected calendar day');

  await card
    .getByLabel('Eigene Aktivität')
    .fill('Synthetic Wärmebad mit ruhiger Musik');
  await card
    .getByRole('button', { name: 'Aktivität erfassen', exact: true })
    .click();
  await card
    .getByRole('button', {
      name: 'Synthetic Wärmebad mit ruhiger Musik für diesen Tag entfernen',
    })
    .waitFor();
  await card.locator('summary').click();

  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => {
      localStorage.setItem('theme', value);
    }, theme);
    await page.reload();
    await card
      .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
      .waitFor();
    await card.locator('summary').click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({
        style: 'nav.apple-safe-area{visibility:hidden!important}',
        path: `${out}/web-de-${theme}-${width}.png`,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflow, false, `${theme}/${width} horizontal overflow`);
    }
  }
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' });
  await card.screenshot({
    style: 'nav.apple-safe-area{visibility:hidden!important}',
    path: `${out}/web-de-large-390.png`,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    ),
    false
  );

  await page.goto(`${base}/diary?date=2026-10-02`);
  await card
    .getByRole('button', { name: 'Sauna erfassen', exact: true })
    .click();
  await card
    .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
    .waitFor();
  await card
    .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
    .click();
  await card
    .getByText('Für diesen Tag wurden keine Wellness-Aktivitäten erfasst.')
    .waitFor();
  await page.goto(`${base}/diary?date=${date}`);
  await card
    .getByRole('button', { name: 'Sauna für diesen Tag entfernen' })
    .waitFor();
  results.push('undo preserves the same activity on other days');

  await page.route('**/api/v2/tracking/habits', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Synthetic save failure"}',
        })
      : route.continue()
  );
  const custom = card.getByLabel('Eigene Aktivität');
  await custom.fill('Synthetic retry activity');
  await card
    .getByRole('button', { name: 'Aktivität erfassen', exact: true })
    .click();
  await page
    .getByText(
      'Die Aktivität konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
    )
    .waitFor();
  assert.equal(await custom.inputValue(), 'Synthetic retry activity');
  await page.unroute('**/api/v2/tracking/habits');
  results.push('failed save retains custom input');

  const create = () =>
    page.request.post(`${base}/api/v2/tracking/habits`, {
      data: {
        name: 'Synthetic concurrent wellness',
        category: 'wellness',
        habit_type: 'completion',
      },
    });
  const concurrent = await Promise.all([create(), create()]);
  const definitions = await Promise.all(
    concurrent.map((response) => response.json())
  );
  assert.equal(definitions[0].id, definitions[1].id);
  const id = definitions[0].id;
  await Promise.all(
    [true, true].map((value) =>
      page.request.put(`${base}/api/v2/tracking/habits/${id}/logs`, {
        data: { entry_date: date, value },
      })
    )
  );
  const logs = await (
    await page.request.get(
      `${base}/api/v2/tracking/habit-logs?start_date=${date}&end_date=${date}&habit_id=${id}`
    )
  ).json();
  assert.equal(logs.length, 1);
  assert.equal(
    (
      await page.request.put(`${base}/api/v2/tracking/habits/${id}`, {
        data: { days: [1] },
      })
    ).status(),
    400
  );
  results.push(
    'simultaneous creates reuse one definition; writes return one daily completion; schedules are rejected'
  );
  const after = await (
    await page.request.get(`${base}/api/v2/tracking/daily-progress/${date}`)
  ).json();
  assert.equal(after.applicable, progress.applicable);
  assert.equal(after.completed, progress.completed);
  results.push('wellness leaves Daily Progress unchanged');
  assert.deepEqual(errors, []);
  const activitiesAfter = await (
    await page.request.get(
      `${base}/api/v2/tracking/habits?include_inactive=true`
    )
  ).json();
  for (const activity of activitiesAfter)
    if (!existingIds.has(activity.id) && activity.category === 'wellness')
      await page.request.delete(
        `${base}/api/v2/tracking/habits/${activity.id}`
      );
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ results, pageErrors: errors }, null, 2)
  );
  console.log(JSON.stringify({ checks: results, output: out }, null, 2));
} finally {
  await browser.close();
}
