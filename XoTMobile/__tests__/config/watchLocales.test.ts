import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWatchLocales } from '../../scripts/validate-native-widget-locales.mjs';

const root = path.resolve(__dirname, '../..');

describe('Watch localization gate', () => {
  it('ships complete German copy with matching native interpolation tokens', () => {
    const result = validateWatchLocales(root);
    expect(result.errors).toEqual([]);
    expect(result.coverage.watch.de.missing).toBe(0);
    expect(result.coverage['watch-widget'].de.missing).toBe(0);
  });

  it('rejects missing German text, new uncatalogued copy and mismatched placeholders', () => {
    const fixture = fs.mkdtempSync(
      path.join(os.tmpdir(), 'xot-watch-locales-')
    );
    try {
      for (const target of ['watch', 'watch-widget']) {
        fs.cpSync(
          path.join(root, 'targets', target),
          path.join(fixture, 'targets', target),
          { recursive: true }
        );
      }
      const catalog = path.join(
        fixture,
        'targets/watch/de.lproj/Localizable.strings'
      );
      fs.writeFileSync(
        catalog,
        fs
          .readFileSync(catalog, 'utf8')
          .replace(/^"food.amount".*\n/m, '')
          .replace('"Wählen Sie die Menge für %@."', '"Wählen Sie die Menge."')
      );
      fs.writeFileSync(
        path.join(fixture, 'targets/watch/NewCopy.swift'),
        'WatchCopy.text("food.newLabel")\nWatchCopy.text("workout.missing")\nText("Untranslated label")\nreturn "Untranslated status"'
      );
      expect(validateWatchLocales(fixture).errors).toEqual(
        expect.arrayContaining([
          'watch: missing German food.amount',
          'watch de:food.chooseHint placeholder mismatch',
          'watch: missing English food.newLabel',
          'watch: missing English workout.missing',
          'watch: hardcoded UI copy NewCopy.swift:3',
          'watch: hardcoded UI copy NewCopy.swift:4',
        ])
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
