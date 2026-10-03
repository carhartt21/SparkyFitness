/** Isolated artwork/production-PWA review. No account, backend or external image API. */
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(root, 'XoTFrontend/dist');
const out = resolve(root, '.visual-sample/bls-artwork');
const inventory = JSON.parse(
  await readFile(
    resolve(root, 'x-on-track-design/food-artwork/manifest.json'),
    'utf8'
  )
);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.json': 'application/json',
};
await stat(resolve(dist, 'sw.js')); // Build production assets before the review.
await mkdir(out, { recursive: true });
const cards = inventory.assets
  .map(
    ({ slug }) =>
      `<article><img class="large" src="/images/food-artwork/${slug}.webp" alt=""><div class="sizes"><img width="40" height="40" src="/images/food-artwork/${slug}.webp" alt=""><img width="64" height="64" src="/images/food-artwork/${slug}.webp" alt=""></div><p>${slug}</p></article>`
  )
  .join('');
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BLS artwork review</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0a171d;color:#eaf2f5;font:16px system-ui}body.light{background:#f5f7f8;color:#172b34}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:16px}article{border:1px solid #31464f;background:#14242b;border-radius:16px;padding:12px;text-align:center}.light article{background:#fff;border-color:#cdd9df}.large{width:100%;height:145px;object-fit:contain}.sizes{display:flex;align-items:center;justify-content:center;gap:16px}.sizes img{object-fit:contain}p{font-size:13px;overflow-wrap:anywhere}</style><h1>BLS · Illustration und kleine Bildgrößen</h1><main>${cards}</main></html>`;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname
    );
    if (pathname === '/artwork-review.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      });
      response.end(html);
      return;
    }
    const file = resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + sep)) throw new Error('Outside fixture root');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolveStarted) =>
  server.listen(0, '127.0.0.1', resolveStarted)
);
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(base))
      failures.push('Unexpected origin: ' + request.url());
  });
  await page.goto(base + '/artwork-review.html');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const sources = [];
  for (const dir of ['food-artwork', 'food-fallbacks', 'off-food-groups']) {
    for (const file of await readdir(resolve(dist, 'images', dir))) {
      if (file.endsWith('.webp')) sources.push(`/images/${dir}/${file}`);
    }
  }
  await context.setOffline(true);
  const offline = await page.evaluate(async (urls) => {
    const result = [];
    for (const url of urls) {
      try {
        // Workbox stores content-hashed revisions in the cache key's query.
        const cached = await caches.match(url, { ignoreSearch: true });
        const response = await fetch(url, { cache: 'no-store' });
        result.push({
          url,
          cached: !!cached,
          status: response.status,
          bytes: (await response.arrayBuffer()).byteLength,
        });
      } catch {
        result.push({ url, cached: false, status: 0, bytes: 0 });
      }
    }
    return result;
  }, sources);
  const unavailable = offline.filter(
    (item) => !item.cached || item.status !== 200 || !item.bytes
  );
  if (unavailable.length)
    throw new Error(
      'Offline artwork unavailable: ' +
        JSON.stringify({
          count: unavailable.length,
          examples: unavailable.slice(0, 10),
        })
    );
  const screenshots = [];
  for (const width of [390, 1100]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(
        (value) => document.body.classList.toggle('light', value === 'light'),
        theme
      );
      await page.waitForFunction(() =>
        Array.from(document.images).every(
          (img) => img.complete && img.naturalWidth === 256
        )
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      if (overflow) throw new Error('Artwork fixture overflow at ' + width);
      const screenshot = resolve(out, `artwork-${width}-${theme}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      screenshots.push(screenshot);
    }
  }
  if (failures.length) throw new Error(JSON.stringify(failures));
  const result = {
    illustrations: inventory.assets.length,
    offline_assets: offline.length,
    screenshots,
    scope:
      'Isolated assets and production service worker; not an account or physical-device test.',
  };
  await writeFile(
    resolve(out, 'browser-review.json'),
    JSON.stringify(result, null, 2) + '\n'
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
