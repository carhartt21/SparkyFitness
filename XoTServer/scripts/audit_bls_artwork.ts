/** Read-only source audit. --write updates derived assets only, never a DB. */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { classifyBlsFoodArtwork } from '@workspace/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const archive = argv[argv.indexOf('--archive') + 1];
if (!argv.includes('--archive') || !archive || archive.startsWith('--')) {
  throw new Error(
    'Usage: pnpm exec tsx scripts/audit_bls_artwork.ts --archive /path/BLS_4_0_2025_DE.zip [--write]'
  );
}
const source = spawnSync(
  'python3',
  [
    '-c',
    `
import importlib.util,json,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('bls',Path(sys.argv[1]))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
rows,eligible=module.parse_archive(Path(sys.argv[2]))
print(json.dumps({'dataset_sha256':module.EXPECTED_SHA256,'eligible':eligible,'foods':[{'code':r[0],'name_de':r[1],'name_en':r[2]} for r in rows]}))
`,
    resolve(root, 'XoTServer/scripts/import_bls4.py'),
    resolve(archive),
  ],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
if (source.status !== 0)
  throw new Error('Pinned BLS archive validation failed: ' + source.stderr);
const dataset = z
  .object({
    dataset_sha256: z.string(),
    eligible: z.number(),
    foods: z.array(
      z.object({
        code: z.string().regex(/^[A-Z][A-Z0-9]{6}$/),
        name_de: z.string(),
        name_en: z.string(),
      })
    ),
  })
  .parse(JSON.parse(source.stdout));
if (
  dataset.foods.length !== 7140 ||
  new Set(dataset.foods.map((food) => food.code)).size !== 7140
) {
  throw new Error('Pinned catalogue must contain 7,140 distinct BLS codes.');
}
const byArtwork: Record<string, string[]> = {};
const basis: Record<string, number> = {};
const audit = dataset.foods.map((food) => {
  const classification = classifyBlsFoodArtwork(food);
  (byArtwork[classification.key] ??= []).push(food.code);
  basis[classification.basis] = (basis[classification.basis] ?? 0) + 1;
  return { ...food, ...classification };
});
const ordered = Object.fromEntries(
  Object.entries(byArtwork)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, codes]) => [key, codes.sort()])
);
for (const key of Object.keys(ordered)) {
  const [kind, slug] = key.split(':');
  const directory =
    kind === 'group'
      ? 'food-fallbacks'
      : kind === 'off'
        ? 'off-food-groups'
        : kind === 'food'
          ? 'food-artwork'
          : null;
  if (!directory || !slug || !/^[a-z][a-z_-]*$/.test(slug))
    throw new Error('Invalid artwork key: ' + key);
  for (const asset of [
    resolve(root, 'XoTMobile/assets', directory, slug + '.png'),
    resolve(root, 'XoTFrontend/public/images', directory, slug + '.webp'),
  ]) {
    if (!existsSync(asset)) throw new Error('Missing artwork: ' + asset);
  }
}
const manifest = {
  version: 1,
  dataset_sha256: dataset.dataset_sha256,
  by_artwork: ordered,
};
const summary = {
  version: 1,
  dataset_sha256: dataset.dataset_sha256,
  records: audit.length,
  core_nutrient_eligible: dataset.eligible,
  by_basis: basis,
  by_artwork: Object.fromEntries(
    Object.entries(ordered).map(([key, codes]) => [key, codes.length])
  ),
  neutral_records: audit.filter((food) => food.basis === 'neutral'),
};
const manifestPath = resolve(
  root,
  'shared/src/foodImages/blsArtworkManifest.json'
);
if (argv.includes('--write'))
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
else if (
  JSON.stringify(JSON.parse(readFileSync(manifestPath, 'utf8'))) !==
  JSON.stringify(manifest)
)
  throw new Error(
    'BLS artwork manifest differs. Review the audit and regenerate with --write.'
  );
const output = resolve(root, '.visual-sample/bls-artwork');
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, 'coverage.json'),
  JSON.stringify(summary, null, 2) + '\n'
);
writeFileSync(
  resolve(output, 'assignments.json'),
  JSON.stringify(audit, null, 2) + '\n'
);
console.log(
  JSON.stringify(
    { ...summary, neutral_records: summary.neutral_records.length, output },
    null,
    2
  )
);
