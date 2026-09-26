#!/usr/bin/env node
// Captures only dedicated review simulators. Never launches or resets a real device.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertRuntimeClean } from '../review/runtime-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) =>
  process.argv.includes(name)
    ? process.argv[process.argv.indexOf(name) + 1]
    : fallback;
const app = arg('--app');
if (!app)
  throw new Error('Supply --app /absolute/path/to/a/development-simulator.app');
const output = path.resolve(arg('--output', '/tmp/xot-ui-review'));
mkdirSync(output, { recursive: true });
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    cwd: root,
    ...options,
  }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runtime = arg('--runtime', 'com.apple.CoreSimulator.SimRuntime.iOS-26-2');
const cases = process.argv.includes('--single')
  ? [
      {
        name: 'baseline-de',
        language: 'de',
        theme: 'Dark',
        scenario: 'populated',
        device: 'iPhone-13',
      },
    ]
  : [
      {
        name: '390-de-dark',
        language: 'de',
        theme: 'Dark',
        scenario: 'populated',
        device: 'iPhone-13',
      },
      {
        name: '430-en-dark',
        language: 'en',
        theme: 'Dark',
        scenario: 'populated',
        device: 'iPhone-14-Pro-Max',
      },
      {
        name: '390-de-light',
        language: 'de',
        theme: 'Light',
        scenario: 'populated',
        device: 'iPhone-13',
      },
      {
        name: '430-de-large',
        language: 'de',
        theme: 'Dark',
        scenario: 'populated',
        device: 'iPhone-14-Pro-Max',
        large: true,
      },
      {
        name: '390-en-empty',
        language: 'en',
        theme: 'Dark',
        scenario: 'empty',
        device: 'iPhone-13',
      },
      {
        name: '390-en-over',
        language: 'en',
        theme: 'Amoled',
        scenario: 'over-target',
        device: 'iPhone-13',
      },
      {
        name: '390-en-error',
        language: 'en',
        theme: 'Dark',
        scenario: 'error',
        device: 'iPhone-13',
      },
    ];
let scenario = cases[0];
const server = createServer((req, res) => {
  if (req.url !== '/scenario') {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(scenario));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(43991, '127.0.0.1', resolve);
});
if (
  await fetch('http://localhost:43990/status', {
    signal: AbortSignal.timeout(1000),
  })
    .then(() => true)
    .catch(() => false)
) {
  server.close();
  throw new Error(
    'Port 43990 already has a server; stop that review process first.'
  );
}
const log = openSync(path.join(output, 'metro.log'), 'w');
const metro = spawn(
  path.join(root, 'node_modules/.bin/expo'),
  ['start', '--lan', '--port', '43990'],
  {
    cwd: root,
    env: {
      ...process.env,
      CI: '1',
      XOT_UI_REVIEW: '1',
      REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', log, log],
    detached: true,
  }
);
const cleanup = () => {
  server.close();
  try {
    process.kill(-metro.pid, 'SIGTERM');
  } catch {
    /* already exited */
  }
};
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    cleanup();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
const results = [];
const nativeProject = path.join(output, 'native');
const runAsync = (command, args, file) =>
  new Promise((resolve, reject) => {
    const fd = openSync(file, 'w');
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', fd, fd],
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${code}); see ${file}`))
    );
  });
try {
  let started = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      await fetch('http://localhost:43990/status', {
        signal: AbortSignal.timeout(2000),
      })
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      started = true;
      break;
    }
    await pause(1000);
  }
  if (!started) throw new Error('Review Metro did not start. See metro.log');
  if (process.argv.includes('--interactions'))
    run('ruby', ['review/make-project.rb', nativeProject]);
  run('swiftc', [
    'review/recognize.swift',
    '-o',
    path.join(output, 'recognize'),
  ]);
  for (const item of cases) {
    scenario = item;
    const name = `XOT UI Review ${item.device}`;
    const devices = Object.values(
      JSON.parse(sim('list', 'devices', 'available', '-j')).devices
    ).flat();
    let device = devices.find((d) => d.name === name);
    if (!device)
      device = {
        udid: sim(
          'create',
          name,
          `com.apple.CoreSimulator.SimDeviceType.${item.device}`,
          runtime
        ),
        state: 'Shutdown',
      };
    if (device.state !== 'Booted') sim('boot', device.udid);
    sim('bootstatus', device.udid, '-b');
    sim('install', device.udid, app);
    sim(
      'status_bar',
      device.udid,
      'override',
      '--time',
      '9:41',
      '--batteryState',
      'charged',
      '--batteryLevel',
      '100'
    );
    sim(
      'ui',
      device.udid,
      'content_size',
      item.large ? 'accessibility-extra-large' : 'large'
    );
    sim(
      'ui',
      device.udid,
      'appearance',
      item.theme === 'Light' ? 'light' : 'dark'
    );
    try {
      sim('terminate', device.udid, 'com.cg.phi');
    } catch {
      /* first launch */
    }
    sim(
      'launch',
      device.udid,
      'com.cg.phi',
      '--initialUrl',
      'http://localhost:43990',
      '-AppleLanguages',
      `(${item.language})`,
      '-AppleLocale',
      item.language === 'de' ? 'de_DE' : 'en_US',
      '-EXDevMenuIsOnboardingFinished',
      'YES',
      '-EXDevMenuShowsAtLaunch',
      'NO',
      '-EXDevMenuShowFloatingActionButton',
      'NO'
    );
    let texts = [],
      passed = false;
    const screenshot = path.join(output, `${item.name}.png`);
    for (let attempt = 0; attempt < 12; attempt++) {
      await pause(5000);
      sim('io', device.udid, 'screenshot', screenshot);
      texts = JSON.parse(run(path.join(output, 'recognize'), [screenshot]));
      assertRuntimeClean(readFileSync(path.join(output, 'metro.log'), 'utf8'));
      const text = texts.map((t) => t.text).join('\n');
      passed =
        item.scenario === 'error'
          ? /Failed to load summary/.test(text)
          : (item.scenario === 'populated'
              ? /1[.,]400/.test(text)
              : item.scenario === 'empty'
                ? /2[.,]000/.test(text)
                : /300/.test(text)) && /kcal/.test(text);
      passed = passed && !/developer menu|Dev tools|Continue/.test(text);
      if (item.language === 'de')
        passed =
          passed && !/Today|Daily energy|Activity burned|Log water/.test(text);
      if (passed) break;
    }
    writeFileSync(
      path.join(output, `${item.name}.ocr.json`),
      JSON.stringify(texts, null, 2)
    );
    results.push({
      ...item,
      screenshot: `${item.name}.png`,
      renderSmokePassed: passed,
      nativeInteractionPassed: null,
      logicalViewport: item.device === 'iPhone-13' ? '390x844' : '430x932',
    });
    console.log(
      `${item.name}: ${passed ? 'render smoke passed' : 'FAILED — inspect screenshot'}`
    );
    if (!passed)
      throw new Error(`No expected product content for ${item.name}`);
    if (
      process.argv.includes('--interactions') &&
      ['baseline-de', '390-de-dark', '430-en-dark'].includes(item.name)
    ) {
      const resultBundle = path.join(output, `${item.name}.xcresult`);
      try {
        await runAsync(
          'xcodebuild',
          [
            'test',
            '-project',
            path.join(nativeProject, 'DashboardReview.xcodeproj'),
            '-scheme',
            'DashboardReview',
            '-destination',
            `platform=iOS Simulator,id=${device.udid}`,
            '-derivedDataPath',
            path.join(nativeProject, 'build'),
            '-parallel-testing-enabled',
            'NO',
            '-resultBundlePath',
            resultBundle,
          ],
          path.join(output, `${item.name}.native.log`)
        );
        results.at(-1).nativeInteractionPassed = true;
      } catch (error) {
        results.at(-1).nativeInteractionPassed = false;
        throw error;
      } finally {
        run('xcrun', [
          'xcresulttool',
          'export',
          'attachments',
          '--path',
          resultBundle,
          '--output-path',
          path.join(output, `${item.name}-attachments`),
        ]);
      }
    }
    assertRuntimeClean(readFileSync(path.join(output, 'metro.log'), 'utf8'));
  }
} finally {
  writeFileSync(
    path.join(output, 'results.json'),
    JSON.stringify(
      {
        revision: run('git', ['rev-parse', 'HEAD']),
        results,
        limitation:
          'Synthetic read-only transport. OCR is a render smoke check, not visual approval or persistence verification.',
      },
      null,
      2
    )
  );
  cleanup();
}
