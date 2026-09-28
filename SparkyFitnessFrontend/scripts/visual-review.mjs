#!/usr/bin/env node
/**
 * Automated web visual review against the isolated demo stack started by
 * `scripts/visual-sample.sh start` (repo root). Signs in through the public
 * demo flow, then captures the Dashboard and Nutrition Reports in dark and
 * light themes at the reference size and narrower widths.
 *
 *   node scripts/visual-review.mjs [--base http://localhost:8080]
 *     [--out ../.visual-sample/captures/<stamp>] [--references <dir>]
 *
 * Uses the locally installed Google Chrome through playwright-core (no browser
 * download). Captures contain only the demo account's generated sample data;
 * they stay under the git-ignored `.visual-sample/` directory by default.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const base = arg('--base', 'http://localhost:8080');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(
  arg('--out', path.join(repoRoot, '.visual-sample', 'captures', stamp))
);
const references = arg('--references');

const viewports = [
  { name: 'reference', width: 1586, height: 992 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];
const themes = ['dark', 'light'];
const pages = [
  { name: 'dashboard', path: '/', reference: 'web/06-dashboard.png' },
  { name: 'diary', path: '/diary', reference: null },
  {
    name: 'reports',
    path: '/reports?tab=charts',
    reference: 'web/07-nutrition-reports.png',
  },
];

async function signInToDemo(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Explore Live Demo/ }).click();
  // The sandbox terms must be acknowledged before the enter button enables.
  await page.locator('#demo-terms-checkbox').check();
  await page.getByRole('button', { name: /I Agree & Enter Demo/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });
}

/** Waits for loading placeholders to clear and animations to settle. */
async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page
    .waitForFunction(
      () =>
        !document
          .querySelector('[role="status"]')
          ?.textContent?.match(/Loading/),
      null,
      { timeout: 15_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(1200);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const consoleErrors = [];
  try {
    for (const theme of themes) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: viewport.isMobile ? 2 : 1,
          isMobile: Boolean(viewport.isMobile),
          hasTouch: Boolean(viewport.isMobile),
          colorScheme: theme,
        });
        await context.addInitScript((value) => {
          window.localStorage.setItem('theme', value);
          // Hide dev-only TanStack Query Devtools; it is not product UI.
          const style = document.createElement('style');
          style.textContent = '.tsqd-parent-container{display:none!important}';
          document.addEventListener('DOMContentLoaded', () =>
            document.head.appendChild(style)
          );
        }, theme);
        // The upstream-release notice (live GitHub check) and admin
        // announcements are modal overlays unrelated to the UI under review.
        await context.route('**/api/version/latest-github', (route) =>
          route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ isNewVersionAvailable: false }),
          })
        );
        await context.route('**/api/announcement/current**', (route) =>
          route.fulfill({ contentType: 'application/json', body: 'null' })
        );
        const page = await context.newPage();
        page.on('console', (message) => {
          if (message.type() === 'error')
            consoleErrors.push(
              `${theme}/${viewport.name}: ${message.text().slice(0, 300)}`
            );
        });
        await signInToDemo(page);
        for (const target of pages) {
          await page.goto(`${base}${target.path}`, {
            waitUntil: 'networkidle',
          });
          await settle(page);
          const file = `${target.name}-${viewport.name}-${viewport.width}x${viewport.height}-${theme}.png`;
          await page.screenshot({ path: path.join(out, file) });
          await page.screenshot({
            path: path.join(out, file.replace('.png', '-full.png')),
            fullPage: true,
          });
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth + 1
          );
          results.push({
            page: target.name,
            theme,
            viewport: viewport.name,
            size: `${viewport.width}x${viewport.height}`,
            file,
            horizontalOverflow: overflow,
            reference:
              references &&
              target.reference &&
              viewport.name === 'reference' &&
              theme === 'dark'
                ? path.join(references, target.reference)
                : null,
          });
          console.log(`${file}${overflow ? '  ⚠ horizontal overflow' : ''}`);
        }
        await context.close();
      }
    }

    if (references) {
      // Side-by-side sheets for the reference-size dark captures.
      const context = await browser.newContext({
        viewport: { width: 1586 * 2 + 24, height: 992 },
      });
      const page = await context.newPage();
      for (const result of results.filter((r) => r.reference)) {
        if (!existsSync(result.reference)) continue;
        const sheet = `compare-${result.page}.png`;
        // setContent pages cannot load file:// images; inline them instead.
        const toUrl = (file) =>
          `data:image/png;base64,${readFileSync(path.resolve(file)).toString('base64')}`;
        await page.setContent(
          `<body style="margin:0;display:flex;gap:24px;background:#111">
             <img src="${toUrl(result.reference)}" width="1586" height="992">
             <img src="${toUrl(path.join(out, result.file))}" width="1586" height="992">
           </body>`
        );
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(out, sheet) });
        result.comparison = sheet;
        console.log(sheet);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    path.join(out, 'results.json'),
    JSON.stringify({ base, results, consoleErrors }, null, 2)
  );
  console.log(`\n${results.length} captures in ${out}`);
  if (consoleErrors.length > 0)
    console.log(
      `${consoleErrors.length} console errors recorded in results.json`
    );
  const overflowing = results.filter((r) => r.horizontalOverflow);
  if (overflowing.length > 0) {
    console.error(
      `Horizontal overflow on: ${overflowing.map((r) => r.file).join(', ')}`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
