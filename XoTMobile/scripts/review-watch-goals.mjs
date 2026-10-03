#!/usr/bin/env node
// Compile real Watch views with synthetic data into a separate review-only app.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const arg = (key, fallback) =>
  process.argv.includes(key)
    ? process.argv[process.argv.indexOf(key) + 1]
    : fallback;
const output = path.resolve(
  arg('--output', '/private/tmp/xot-watch-goals-review')
);
const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', cwd: root }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const files = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name)]
    );
fs.mkdirSync(output, { recursive: true });
const app = path.join(output, 'XotWatchReview.app');
fs.mkdirSync(app, { recursive: true });
const sources = files(path.join(root, 'targets/watch')).filter(
  (file) => file.endsWith('.swift') && !file.endsWith('/XOnTrackWatchApp.swift')
);
const harness = path.join(root, 'review/WatchGoalsReview.swift');
const sdk = run('xcrun', ['--sdk', 'watchsimulator', '--show-sdk-path']);
run('xcrun', [
  'swiftc',
  '-sdk',
  sdk,
  '-target',
  'arm64-apple-watchos11.0-simulator',
  '-emit-executable',
  '-o',
  path.join(app, 'XotWatchReview'),
  ...sources,
  harness,
]);
for (const language of ['en', 'de'])
  fs.cpSync(
    path.join(root, `targets/watch/${language}.lproj`),
    path.join(app, `${language}.lproj`),
    { recursive: true }
  );
const identifier = 'com.cg.phi.watchkitapp.review';
fs.writeFileSync(
  path.join(app, 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${identifier}</string><key>CFBundleExecutable</key><string>XotWatchReview</string><key>CFBundleName</key><string>XotWatchReview</string><key>CFBundleDisplayName</key><string>X on Track Review</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>11.0</string><key>CFBundleSupportedPlatforms</key><array><string>WatchSimulator</string></array><key>WKWatchOnly</key><true/><key>WKApplication</key><true/><key>UIDeviceFamily</key><array><integer>4</integer></array><key>DTPlatformName</key><string>watchsimulator</string></dict></plist>`
);
run('codesign', ['--force', '--sign', '-', app]);
const name = 'XOT UI Review Watch v39 corrections';
const devices = Object.values(
  JSON.parse(sim('list', 'devices', 'available', '--json')).devices
).flat();
const device =
  devices.find((value) => value.name === name)?.udid ??
  sim(
    'create',
    name,
    'com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-11-42mm',
    arg('--runtime', 'com.apple.CoreSimulator.SimRuntime.watchOS-26-2')
  );
try {
  sim('boot', device);
} catch {
  /* already booted */
}
sim('bootstatus', device, '-b');
// Only the dedicated synthetic bundle is reset; production app data is untouched.
try {
  sim('uninstall', device, identifier);
} catch {
  /* first run */
}
sim('install', device, app);
sim(
  'launch',
  device,
  identifier,
  '-AppleLanguages',
  '(de)',
  '-AppleLocale',
  'de_DE'
);
const container = sim('get_app_container', device, identifier, 'data');
const assertions = path.join(container, 'Documents/assertions.json');
for (let attempt = 0; attempt < 20 && !fs.existsSync(assertions); attempt++)
  await new Promise((resolve) => setTimeout(resolve, 500));
if (!fs.existsSync(assertions))
  throw new Error(
    'Watch review assertions did not complete. Inspect the dedicated simulator/crash log.'
  );
const evidence = JSON.parse(fs.readFileSync(assertions, 'utf8'));
await new Promise((resolve) => setTimeout(resolve, 1500));
sim('io', device, 'screenshot', path.join(output, 'watch-goals-de.png'));
for (const [name, flags] of [
  ['watch-intake-de', []],
  ['watch-intake-unknown-de', ['--nutrition-unknown']],
  ['watch-intake-over-de', ['--nutrition-over']],
]) {
  sim('terminate', device, identifier);
  sim(
    'launch',
    device,
    identifier,
    '-AppleLanguages',
    '(de)',
    '-AppleLocale',
    'de_DE',
    '--intake',
    ...flags
  );
  await new Promise((resolve) => setTimeout(resolve, 1800));
  sim('io', device, 'screenshot', path.join(output, `${name}.png`));
}
const hash = createHash('sha256');
for (const file of [...sources, harness]) hash.update(fs.readFileSync(file));
fs.writeFileSync(
  path.join(output, 'results.json'),
  JSON.stringify(
    {
      ...evidence,
      device,
      sourceSha256: hash.digest('hex'),
      screenshots: [
        'watch-goals-de.png',
        'watch-intake-de.png',
        'watch-intake-unknown-de.png',
        'watch-intake-over-de.png',
      ],
      limits:
        'Synthetic simulator; no phone/server round-trip or physical Watch delivery verified.',
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify(evidence));
