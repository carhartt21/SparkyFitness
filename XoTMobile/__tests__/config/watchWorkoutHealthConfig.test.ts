import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

it('generates the watchOS workout background mode and preserves HealthKit and app-group capabilities', () => {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'xot-watch-health-config-')
  );
  const root = path.resolve(__dirname, '../..');
  const target = path.join(fixture, 'targets/watch');
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(
      path.join(root, 'app.identifiers.js'),
      path.join(fixture, 'app.identifiers.js')
    );
    const configPath = path.join(target, 'expo-target.config.js');
    fs.copyFileSync(
      path.join(root, 'targets/watch/expo-target.config.js'),
      configPath
    );
    const configure = require(configPath) as (
      config: Record<string, never>
    ) => {
      frameworks: string[];
      entitlements: Record<string, boolean | string[]>;
    };
    const config = configure({});
    const plist = fs.readFileSync(path.join(target, 'Info.plist'), 'utf8');
    expect(plist).toMatch(
      /<key>WKBackgroundModes<\/key>\s*<array><string>workout-processing<\/string><\/array>/
    );
    expect(plist).not.toContain('<key>UIBackgroundModes</key>');
    expect(config.frameworks).toContain('HealthKit');
    expect(config.entitlements['com.apple.developer.healthkit']).toBe(true);
    expect(
      config.entitlements['com.apple.security.application-groups']
    ).toEqual(expect.arrayContaining([expect.stringMatching(/^group\./)]));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
