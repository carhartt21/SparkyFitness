#!/usr/bin/env node
// Writes targets/watch-widget/ProgressXGeometry.swift from the shared X
// geometry. `--check` fails when the Swift file no longer matches, so an edit
// to the brand geometry cannot silently leave the watch face drawing the old X.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { renderWatchProgressXGeometry } from './watchProgressXGeometry.mjs';

const target = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'targets',
  'watch-widget',
  'ProgressXGeometry.swift'
);

const expected = renderWatchProgressXGeometry();
if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== expected) {
    console.error(
      'targets/watch-widget/ProgressXGeometry.swift is out of date. Run: pnpm exec tsx scripts/generate-watch-progress-x.mjs'
    );
    process.exit(1);
  }
  console.log('Watch Progress X geometry is up to date.');
} else {
  fs.writeFileSync(target, expected);
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}
