// Renders the production SwiftUI content with synthetic entries in a Simulator app.
// This is a layout aid, not a WidgetKit host or a deep-link/account-isolation test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'targets/widget');
const args = process.argv.slice(2);
const before = args.includes('--before');
const outputArg = args.indexOf('--output-dir');
const output =
  outputArg >= 0
    ? path.resolve(args[outputArg + 1])
    : fs.mkdtempSync(path.join(os.tmpdir(), 'xot-widget-captures-'));
fs.mkdirSync(output, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xot-widget-content-'));
const app = path.join(temporary, 'WidgetPreview.app');
fs.mkdirSync(app);
const bundleId = 'com.xot.widget-brand-preview';
const run = (command, params) =>
  execFileSync(command, params, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
const baselineFiles = before
  ? run('git', [
      'ls-tree',
      '--full-tree',
      '-r',
      '--name-only',
      'origin/main',
      'XoTMobile/targets/widget/',
    ])
      .split('\n')
      .filter(
        (file) => file.endsWith('.swift') && !file.endsWith('/index.swift')
      )
  : [];
const baseline = before
  ? baselineFiles
      .map((file) => run('git', ['show', `origin/main:${file}`]))
      .join('\n')
  : '';
const source = before
  ? baseline +
    (baseline.includes('struct WidgetSurface:')
      ? ''
      : '\nstruct WidgetSurface: View { var body: some View { Color(uiColor: .tertiarySystemBackground) } }\n')
  : fs
      .readdirSync(target)
      .filter((file) => file.endsWith('.swift') && file !== 'index.swift')
      .map((file) => fs.readFileSync(path.join(target, file), 'utf8'))
      .join('\n');
const fixture = fs.readFileSync(
  path.join(root, 'scripts/widget-content-preview.swift'),
  'utf8'
);
const swift = path.join(temporary, 'Preview.swift');
// WidgetKit's family environment is read-only outside a host; adapt only the
// environment key for this temporary fixture. Production render bodies stay intact.
fs.writeFileSync(
  swift,
  source.replaceAll('\\.widgetFamily', '\\.previewWidgetFamily') + fixture
);
for (const locale of ['en', 'de']) {
  const directory = path.join(app, `${locale}.lproj`);
  fs.mkdirSync(directory);
  fs.copyFileSync(
    path.join(target, `${locale}.lproj/Localizable.strings`),
    path.join(directory, 'Localizable.strings')
  );
}
fs.writeFileSync(
  path.join(app, 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${bundleId}</string>
<key>CFBundleExecutable</key><string>WidgetPreview</string>
<key>CFBundleName</key><string>WidgetPreview</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleDevelopmentRegion</key><string>en</string>
<key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>2</integer></array>
<key>UILaunchScreen</key><dict/>
</dict></plist>`
);
let simulator;
try {
  const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
  if (before) {
    const assets = path.join(temporary, 'Assets.xcassets');
    fs.mkdirSync(assets);
    fs.writeFileSync(
      path.join(assets, 'Contents.json'),
      JSON.stringify({ info: { version: 1, author: 'xcode' } })
    );
    fs.cpSync(
      path.join(target, 'Assets.xcassets/AccentColor.colorset'),
      path.join(assets, 'AccentColor.colorset'),
      { recursive: true }
    );
    run('xcrun', [
      '--sdk',
      'iphonesimulator',
      'actool',
      assets,
      '--compile',
      app,
      '--platform',
      'iphonesimulator',
      '--minimum-deployment-target',
      '17.0',
      '--target-device',
      'ipad',
    ]);
  }

  run('xcrun', [
    '--sdk',
    'iphonesimulator',
    'swiftc',
    '-parse-as-library',
    '-module-name',
    'WidgetPreview',
    '-sdk',
    sdk,
    '-target',
    'arm64-apple-ios17.0-simulator',
    swift,
    '-o',
    path.join(app, 'WidgetPreview'),
  ]);
  run('codesign', ['--force', '--sign', '-', app]);
  const { runtimes } = JSON.parse(
    run('xcrun', ['simctl', 'list', 'runtimes', '-j'])
  );
  const runtime = runtimes
    .filter((item) => item.isAvailable && item.name.startsWith('iOS'))
    .sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true })
    )[0];
  if (!runtime) throw new Error('An iOS Simulator runtime is required');
  simulator = run('xcrun', [
    'simctl',
    'create',
    'XOT Widget Content Review',
    'com.apple.CoreSimulator.SimDeviceType.iPad-mini-A17-Pro',
    runtime.identifier,
  ]);
  run('xcrun', ['simctl', 'boot', simulator]);
  run('xcrun', ['simctl', 'bootstatus', simulator, '-b']);
  run('xcrun', ['simctl', 'install', simulator, app]);
  const captures = before
    ? [['before-dark', []]]
    : [
        ['after-dark', []],
        ['after-light', ['light']],
        ['after-de-large', ['large']],
        ['after-tinted-empty', ['tinted', 'empty']],
      ];
  for (const [name, flags] of captures) {
    const german = name.includes('de-') || name.includes('empty');
    run('xcrun', [
      'simctl',
      'launch',
      simulator,
      bundleId,
      ...flags,
      '-AppleLanguages',
      german ? '(de)' : '(en)',
      '-AppleLocale',
      german ? 'de_DE' : 'en_US',
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    run('xcrun', [
      'simctl',
      'io',
      simulator,
      'screenshot',
      path.join(output, `${name}.png`),
    ]);
    run('xcrun', ['simctl', 'terminate', simulator, bundleId]);
  }
  console.log(`Native content captures: ${output}`);
} finally {
  if (simulator) {
    const devices = JSON.parse(
      run('xcrun', ['simctl', 'list', 'devices', '-j'])
    );
    const device = Object.values(devices.devices)
      .flat()
      .find((item) => item.udid === simulator);
    if (device?.state === 'Booted')
      run('xcrun', ['simctl', 'shutdown', simulator]);
    run('xcrun', ['simctl', 'delete', simulator]);
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
