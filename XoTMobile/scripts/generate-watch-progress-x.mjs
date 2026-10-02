#!/usr/bin/env node
// Writes targets/watch-widget/ProgressXGeometry.swift from the shared X
// geometry. `--check` fails when the Swift file no longer matches, so an edit
// to the brand geometry cannot silently leave the watch face drawing the old X.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { renderWatchProgressXGeometry } from './watchProgressXGeometry.mjs';

const base = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const drawing = fs.readFileSync(
  path.join(base, 'scripts/watchProgressXDrawing.swift.template'),
  'utf8'
);
for (const surface of ['watch-widget', 'watch']) {
  for (const [name, expected] of [
    ['ProgressXGeometry.swift', renderWatchProgressXGeometry()],
    ['ProgressXDrawing.swift', drawing],
  ]) {
    const target = path.join(base, 'targets', surface, name);
    if (process.argv.includes('--check')) {
      if (
        !fs.existsSync(target) ||
        fs.readFileSync(target, 'utf8') !== expected
      ) {
        console.error(
          `${surface}/${name} is out of date. Run pnpm exec tsx scripts/generate-watch-progress-x.mjs`
        );
        process.exit(1);
      }
    } else fs.writeFileSync(target, expected);
  }
}
console.log(
  'Watch app and complication Progress X geometry/drawing are in sync.'
);
