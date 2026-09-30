import fs from 'fs';
import path from 'path';

function localizedStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  return Object.values(value).flatMap(localizedStrings);
}

describe('brand identity in web translations', () => {
  it('does not display the former product or assistant name', () => {
    const localeRoot = path.join(process.cwd(), 'public', 'locales');
    for (const locale of fs.readdirSync(localeRoot)) {
      const catalogPath = path.join(localeRoot, locale, 'translation.json');
      if (!fs.existsSync(catalogPath)) continue;
      const catalog: unknown = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      expect(localizedStrings(catalog).join('\n')).not.toMatch(
        /sparky|سباركي|Спарки|スパーキー|스파키/i
      );
    }
  });

  it('uses the platform name for its calculations and Trackbot for chat', () => {
    const catalog = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'public', 'locales', 'en', 'translation.json'),
        'utf8'
      )
    ) as {
      settings: {
        goalMode: { calibrationDescription: string };
        aiService: { userSettings: { noServicesDescription: string } };
      };
    };
    expect(catalog.settings.goalMode.calibrationDescription).toContain(
      "X on Track's Adaptive TDEE"
    );
    expect(
      catalog.settings.aiService.userSettings.noServicesDescription
    ).toContain('Trackbot');
  });
});
