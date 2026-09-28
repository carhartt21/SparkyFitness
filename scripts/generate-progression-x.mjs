import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const geometry = JSON.parse(readFileSync(resolve(root, 'shared/src/brand/progressionX.geometry.json'), 'utf8'));
const outputDir = resolve(root, 'assets/brand');
mkdirSync(outputDir, { recursive: true });

const write = (path, contents) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

function markSvg({ state = 'full', light = false, background = true } = {}) {
  const baseline = light ? geometry.baselineLight : geometry.baselineDark;
  const surface = light ? '#F4F3ED' : geometry.background;
  const gradients = geometry.segments.map(({ id, gradient }) =>
    `<linearGradient id="${id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${gradient.from}"/><stop offset="1" stop-color="${gradient.to}"/></linearGradient>`
  ).join('');
  const paths = geometry.segments.map(({ id, kind, path, strokeWidth, taperPath }) => {
    const color = state === 'full' ? `url(#${id})` : baseline;
    return kind === 'stroke'
      ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>${taperPath ? `<path d="${taperPath}" fill="${color}"/>` : ''}`
      : `<path d="${path}" fill="${color}"/>`;
  }).join('');
  const panel = background ? `<rect width="320" height="320" fill="${surface}"/><rect x="22" y="22" width="276" height="276" rx="55" fill="none" stroke="${light ? '#B7C3C9' : 'url(#border-spectrum)'}" stroke-width="1.5"/>` : '';
  // The blurred duplicate is decorative only. The solid paths above remain the
  // canonical geometry, including at small launcher/widget sizes.
  const glow = state === 'full' && !light && background
    ? `<g opacity="0.36" filter="url(#soft-glow)">${paths}</g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${geometry.viewBox}" role="img" aria-label="X on Track"><defs>${gradients}<linearGradient id="border-spectrum" x1="22" y1="298" x2="298" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#B22859"/><stop offset="0.48" stop-color="#295B69"/><stop offset="1" stop-color="#0AC78C"/></linearGradient><filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>${panel}${glow}${paths}</svg>\n`;
}

const fullSvg = resolve(outputDir, 'progression-x.svg');
const emptySvg = resolve(outputDir, 'progression-x-empty.svg');
const lightSvg = resolve(outputDir, 'progression-x-light.svg');
const markSvgFile = resolve(outputDir, 'progression-x-mark.svg');
write(fullSvg, markSvg());
write(emptySvg, markSvg({ state: 'empty' }));
write(lightSvg, markSvg({ light: true }));
write(markSvgFile, markSvg({ background: false }));

const webBrand = resolve(root, 'SparkyFitnessFrontend/public/images/brand/progression-x.svg');
copyFileSync(fullSvg, webBrand);

const exportPng = (source, target, size) => {
  mkdirSync(dirname(target), { recursive: true });
  const result = spawnSync('sips', ['-s', 'format', 'png', source, '--out', target], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'sips failed');
  if (size !== 1024) {
    const resized = spawnSync('sips', ['-z', String(size), String(size), target], { encoding: 'utf8' });
    if (resized.status !== 0) throw new Error(resized.stderr || resized.stdout || 'sips resize failed');
  }
};

if (process.platform === 'darwin') {
  const targets = [
    [fullSvg, 'SparkyFitnessMobile/assets/icons/x-on-track-app-icon.png', 1024],
    [fullSvg, 'SparkyFitnessMobile/assets/icons/appicon.icon/Assets/X on Track Dark.png', 1024],
    [lightSvg, 'SparkyFitnessMobile/assets/icons/appicon.icon/Assets/X on Track Light.png', 1024],
    [fullSvg, 'SparkyFitnessMobile/assets/brand/progression-x.png', 1024],
    [lightSvg, 'SparkyFitnessMobile/assets/brand/progression-x-light.png', 1024],
    [markSvgFile, 'SparkyFitnessMobile/assets/icons/adaptiveicon.png', 1024],
    [fullSvg, 'SparkyFitnessFrontend/public/images/brand/progression-x.png', 512],
    [lightSvg, 'SparkyFitnessFrontend/public/images/brand/progression-x-light.png', 512],
    [fullSvg, 'SparkyFitnessFrontend/public/images/icons/icon-512x512.png', 512],
    [fullSvg, 'SparkyFitnessFrontend/public/images/icons/icon-192x192.png', 192],
  ];
  for (const [source, target, size] of targets) exportPng(source, resolve(root, target), size);
}
