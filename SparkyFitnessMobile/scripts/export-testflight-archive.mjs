#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const usage = `Usage:
  node scripts/export-testflight-archive.mjs prepare --credentials PATH --xcconfig PATH
  node scripts/export-testflight-archive.mjs export --credentials PATH --archive PATH --output-dir PATH

prepare writes an Xcode setting for the certificate in EAS credentials.
export signs an existing archive and creates an App Store IPA.
Run from SparkyFitnessMobile on macOS. Credentials stay on this machine.`;

function fail(message) {
  throw new Error(message);
}

function parseArgs(args) {
  const input = args[0] === '--' ? args.slice(1) : args;
  if (input.length === 0 || input.includes('--help')) {
    console.log(usage);
    process.exit(0);
  }
  const [action, ...rest] = input;
  if (!['prepare', 'export'].includes(action))
    fail(`Unknown action: ${action}`);
  const names = {
    '--credentials': 'credentials',
    '--xcconfig': 'xcconfig',
    '--archive': 'archive',
    '--output-dir': 'outputDir',
  };
  const options = { action };
  for (let i = 0; i < rest.length; i += 2) {
    const name = names[rest[i]];
    if (!name || !rest[i + 1] || rest[i + 1].startsWith('--'))
      fail(`Invalid option: ${rest[i]}`);
    options[name] = rest[i + 1];
  }
  if (!options.credentials) fail('--credentials is required');
  if (
    action === 'prepare' &&
    (!options.xcconfig || options.archive || options.outputDir)
  ) {
    fail(
      'prepare requires --xcconfig and only accepts --credentials otherwise'
    );
  }
  if (
    action === 'export' &&
    (!options.archive || !options.outputDir || options.xcconfig)
  ) {
    fail('export requires --archive and --output-dir');
  }
  return options;
}

function command(name, args, input) {
  const result = spawnSync(name, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    fail(`${name} failed with status ${result.status ?? result.error?.code}`);
  return result.stdout;
}

function plistValue(xml, key) {
  return command('plutil', ['-extract', key, 'raw', '-'], xml).trim();
}

function xml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function loadTargets(filename) {
  const source = path.resolve(filename);
  if (!existsSync(source)) fail(`Credentials file does not exist: ${source}`);
  const ios = JSON.parse(readFileSync(source, 'utf8')).ios;
  if (!ios || !Object.keys(ios).length)
    fail('credentials.json has no iOS targets');
  const targets = Object.entries(ios).map(([name, data]) => {
    const cert = data.distributionCertificate;
    if (!cert?.path || !cert.password || !data.provisioningProfilePath)
      fail(`Incomplete credentials for ${name}`);
    const certPath = path.resolve(path.dirname(source), cert.path);
    const profilePath = path.resolve(
      path.dirname(source),
      data.provisioningProfilePath
    );
    if (!existsSync(certPath) || !existsSync(profilePath))
      fail(`Missing credential file for ${name}`);
    const decoded = command('security', ['cms', '-D', '-i', profilePath]);
    const teamId = plistValue(decoded, 'TeamIdentifier.0');
    const applicationId = plistValue(
      decoded,
      'Entitlements.application-identifier'
    );
    if (
      !applicationId.startsWith(`${teamId}.`) ||
      applicationId.includes('*')
    ) {
      fail(`Expected an explicit bundle identifier for ${name}`);
    }
    return {
      name,
      certPath,
      certPassword: cert.password,
      profilePath,
      teamId,
      bundleId: applicationId.slice(teamId.length + 1),
      uuid: plistValue(decoded, 'UUID'),
    };
  });
  if (new Set(targets.map((target) => target.teamId)).size !== 1)
    fail('Targets use different Apple teams');
  if (new Set(targets.map((target) => target.bundleId)).size !== targets.length)
    fail('Duplicate bundle identifiers');
  return targets;
}

function withSigningKeychain(targets, work) {
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'sparky-testflight-signing-')
  );
  const keychain = path.join(tempDir, 'signing.keychain-db');
  const password = randomBytes(32).toString('hex');
  const original = [
    ...command('security', ['list-keychains', '-d', 'user']).matchAll(
      /"([^"]+)"/g
    ),
  ].map((match) => match[1]);
  if (!original.length) fail('No user keychain is configured');
  let changedSearchList = false;
  let primaryError;
  try {
    command('security', ['create-keychain', '-p', password, keychain]);
    command('security', ['unlock-keychain', '-p', password, keychain]);
    command('security', ['set-keychain-settings', '-lut', '21600', keychain]);
    command('security', [
      'list-keychains',
      '-d',
      'user',
      '-s',
      keychain,
      ...original,
    ]);
    changedSearchList = true;
    command('security', [
      'import',
      targets[0].certPath,
      '-k',
      keychain,
      '-P',
      targets[0].certPassword,
      '-A',
    ]);
    command('security', [
      'set-key-partition-list',
      '-S',
      'apple-tool:,apple:',
      '-s',
      '-k',
      password,
      keychain,
    ]);
    const identities = command('security', [
      'find-identity',
      '-v',
      '-p',
      'codesigning',
      keychain,
    ]);
    const matches = [
      ...identities.matchAll(/^\s*\d+\)\s+([A-F0-9]{40})\s+"[^"]+"/gm),
    ];
    if (matches.length !== 1)
      fail(`Expected one signing identity; found ${matches.length}`);
    return work({ keychain, fingerprint: matches[0][1], tempDir });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const cleanup of [
      () => {
        if (changedSearchList)
          command('security', [
            'list-keychains',
            '-d',
            'user',
            '-s',
            ...original,
          ]);
      },
      () => {
        if (existsSync(keychain))
          command('security', ['delete-keychain', keychain]);
      },
      () => rmSync(tempDir, { recursive: true, force: true }),
    ]) {
      try {
        cleanup();
      } catch (error) {
        cleanupErrors.push(error.message);
      }
    }
    if (cleanupErrors.length) {
      if (primaryError)
        console.error(`Cleanup also failed: ${cleanupErrors.join('; ')}`);
      else fail(`Cleanup failed: ${cleanupErrors.join('; ')}`);
    }
  }
}

function exportArchive(options, targets, signing) {
  const archive = path.resolve(options.archive);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(archive) || !statSync(archive).isDirectory())
    fail(`Archive does not exist: ${archive}`);
  if (
    existsSync(outputDir) &&
    readdirSync(outputDir).some((name) => name.endsWith('.ipa'))
  ) {
    fail(`Output directory already contains an IPA: ${outputDir}`);
  }
  mkdirSync(outputDir, { recursive: true });
  const profilesDir = path.join(
    os.homedir(),
    'Library/Developer/Xcode/UserData/Provisioning Profiles'
  );
  mkdirSync(profilesDir, { recursive: true });
  const installed = [];
  try {
    for (const target of targets) {
      const destination = path.join(
        profilesDir,
        `${target.uuid}.mobileprovision`
      );
      if (existsSync(destination)) {
        if (
          !readFileSync(destination).equals(readFileSync(target.profilePath))
        ) {
          fail(`Installed profile ${target.uuid} differs from EAS credentials`);
        }
      } else {
        copyFileSync(target.profilePath, destination);
        installed.push(destination);
      }
    }
    const profiles = targets
      .map(
        (target) =>
          `<key>${xml(target.bundleId)}</key><string>${xml(target.uuid)}</string>`
      )
      .join('');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>teamID</key><string>${xml(targets[0].teamId)}</string><key>signingStyle</key><string>manual</string><key>signingCertificate</key><string>${signing.fingerprint}</string><key>provisioningProfiles</key><dict>${profiles}</dict></dict></plist>`;
    const optionsFile = path.join(signing.tempDir, 'ExportOptions.plist');
    writeFileSync(optionsFile, plist, { mode: 0o600 });
    const result = spawnSync(
      'xcodebuild',
      [
        '-exportArchive',
        '-archivePath',
        archive,
        '-exportPath',
        outputDir,
        '-exportOptionsPlist',
        optionsFile,
        `OTHER_CODE_SIGN_FLAGS=--keychain ${signing.keychain}`,
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
    const log = path.join(outputDir, 'export.log');
    writeFileSync(log, (result.stdout || '') + (result.stderr || ''), {
      mode: 0o600,
    });
    if (result.error || result.status !== 0)
      fail(`Xcode export failed; see ${log}`);
    const ipa = readdirSync(outputDir).find((name) => name.endsWith('.ipa'));
    if (!ipa)
      fail(`Xcode reported success but no IPA was found in ${outputDir}`);
    return path.join(outputDir, ipa);
  } finally {
    for (const file of installed) rmSync(file, { force: true });
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (process.platform !== 'darwin') fail('This tool requires macOS');
  const targets = loadTargets(options.credentials);
  if (options.action === 'prepare') {
    const xcconfig = path.resolve(options.xcconfig);
    if (existsSync(xcconfig)) fail(`Refusing to replace ${xcconfig}`);
    mkdirSync(path.dirname(xcconfig), { recursive: true });
    withSigningKeychain(targets, (signing) => {
      writeFileSync(xcconfig, `CODE_SIGN_IDENTITY = ${signing.fingerprint}\n`, {
        mode: 0o600,
      });
      console.log(`Signing configuration: ${xcconfig}`);
      console.log(`Apple team: ${targets[0].teamId}`);
    });
  } else {
    const ipa = withSigningKeychain(targets, (signing) =>
      exportArchive(options, targets, signing)
    );
    console.log(`Exported IPA: ${ipa}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
