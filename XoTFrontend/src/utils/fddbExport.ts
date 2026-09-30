import Papa from 'papaparse';
import type {
  FddbActivityRow,
  FddbCustomFood,
  FddbDiaryRow,
  FddbMeasurement,
  FddbRecipe,
} from '@workspace/shared';

export interface FddbExport {
  diary: FddbDiaryRow[];
  activities: FddbActivityRow[];
  customFoods: FddbCustomFood[];
  recipes: FddbRecipe[];
  favorites: string[];
  measurements: FddbMeasurement[];
  imageCount: number;
  ignoredProfileCount: number;
  ignoredTransactionCount: number;
  dateRange: { first: string; last: string } | null;
  warnings: string[];
}

const SECTION_NAMES = new Set([
  'userhistory',
  'diary',
  'profile',
  'friends',
  'lists',
  'community',
  'images',
  'marker',
  'newitems',
  'reviews',
  'transactions',
]);

const PORTION_RE = /^\s*(\d+(?:[,.]\d+)?)\s*(g|kg|ml|l|Stk|Stück)\b\s*(.+)$/i;
const DURATION_RE = /^\s*(\d+(?:[,.]\d+)?)\s+Minuten\b\s*(.+)$/i;
const DATE_TIME_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

const number = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const optionalNumber = (value: string | undefined): number | undefined => {
  const parsed = number(value);
  return parsed === null ? undefined : parsed;
};

const isoDate = (day: string, month: string, year: string): string | null => {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
};

const isSectionMarker = (row: string[]): boolean =>
  SECTION_NAMES.has((row[0] ?? '').trim().toLowerCase()) &&
  row.slice(1).every((cell) => cell.trim() === '');

/** Parse locally so profile and transaction fields never enter an API request. */
export const parseFddbExport = (text: string): FddbExport => {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimiter: ';',
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      `The FDDB CSV is malformed near row ${(parsed.errors[0]?.row ?? 0) + 1}.`
    );
  }

  const sections = new Map<string, { header: string[]; rows: string[][] }>();
  let current: string | null = null;
  let needsHeader = false;
  for (const row of parsed.data) {
    if (isSectionMarker(row)) {
      current = (row[0] ?? '').trim().toLowerCase();
      sections.set(current, { header: [], rows: [] });
      needsHeader = true;
      continue;
    }
    if (!current) continue;
    const section = sections.get(current);
    if (!section) continue;
    if (needsHeader) {
      section.header = row;
      needsHeader = false;
    } else {
      section.rows.push(row);
    }
  }
  const diarySection = sections.get('diary');
  if (
    !diarySection ||
    diarySection.header[0] !== 'datum_tag_monat_jahr_stunde_minute' ||
    diarySection.header[3] !== 'kj' ||
    !sections.get('lists') ||
    !sections.get('newitems')
  ) {
    throw new Error('This is not a supported complete FDDB account export.');
  }

  const result: FddbExport = {
    diary: [],
    activities: [],
    customFoods: [],
    recipes: [],
    favorites: [],
    measurements: [],
    imageCount: sections.get('images')?.rows.length ?? 0,
    ignoredProfileCount: sections.get('profile')?.rows.length ?? 0,
    ignoredTransactionCount: sections.get('transactions')?.rows.length ?? 0,
    dateRange: null,
    warnings: [],
  };

  const occurrences = new Map<string, number>();
  for (const [index, row] of diarySection.rows.entries()) {
    const timestamp = row[0]?.trim() ?? '';
    const label = row[1]?.trim() ?? '';
    const match = DATE_TIME_RE.exec(timestamp);
    const date =
      match && isoDate(match[1] ?? '', match[2] ?? '', match[3] ?? '');
    const hour = match ? Number(match[4]) : -1;
    const minute = match ? Number(match[5]) : -1;
    const energyKj = number(row[3]);
    const activityKj = number(row[4]);
    const fat = number(row[5]);
    const carbs = number(row[6]);
    const protein = number(row[7]);
    if (
      !date ||
      hour > 23 ||
      minute > 59 ||
      !label ||
      energyKj === null ||
      activityKj === null ||
      fat === null ||
      carbs === null ||
      protein === null
    ) {
      result.warnings.push(
        `Diary row ${index + 1} has invalid date or nutrition and was skipped.`
      );
      continue;
    }
    const identity = `${timestamp}\u0000${row[2] ?? ''}\u0000${label}`;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const sourceKey = `${identity}\u0000${occurrence}`;
    const time = `${match![4]}:${match![5]}`;
    if (activityKj > 0) {
      if (energyKj > 0) {
        result.warnings.push(
          `Diary row ${index + 1} combines food and activity energy and was skipped.`
        );
        continue;
      }
      const duration = DURATION_RE.exec(label);
      if (
        !duration ||
        !Number.isFinite(Number((duration[1] ?? '').replace(',', '.')))
      ) {
        result.warnings.push(
          `Activity row ${index + 1} lacks a readable duration and was skipped.`
        );
        continue;
      }
      result.activities.push({
        sourceKey,
        date,
        time,
        name: (duration[2] ?? '').trim(),
        durationMinutes: Number((duration[1] ?? '').replace(',', '.')),
        caloriesBurned:
          Math.round((activityKj / 4.184) * 1_000_000) / 1_000_000,
      });
      continue;
    }
    const portion = PORTION_RE.exec(label);
    const quantity = portion ? Number((portion[1] ?? '').replace(',', '.')) : 1;
    const unit = portion ? (portion[2] ?? '').toLowerCase() : 'serving';
    if (!Number.isFinite(quantity) || quantity < 0) {
      result.warnings.push(
        `Diary row ${index + 1} has an invalid portion and was skipped.`
      );
      continue;
    }
    // FDDB sometimes rounds a tiny amount to "0 g/ml" while retaining energy.
    // Preserve the logged snapshot without inventing a measured mass.
    const roundedToZero = quantity === 0;
    result.diary.push({
      sourceKey,
      date,
      time,
      foodName: roundedToZero
        ? label
        : portion
          ? (portion[3] ?? '').trim()
          : label,
      quantity: roundedToZero ? 1 : quantity,
      unit: roundedToZero
        ? 'serving'
        : unit === 'stk' || unit === 'stück'
          ? 'piece'
          : unit,
      calories: Math.round((energyKj / 4.184) * 1_000_000) / 1_000_000,
      protein,
      carbs,
      fat,
    });
  }

  const dates = result.diary.map((row) => row.date).sort();
  if (dates.length && dates[0] && dates[dates.length - 1]) {
    result.dateRange = { first: dates[0]!, last: dates[dates.length - 1]! };
  }

  for (const [index, row] of (sections.get('newitems')?.rows ?? []).entries()) {
    const name = row[0]?.trim() ?? '';
    const kj = number(row[1]);
    const carbs = number(row[2]);
    const fat = number(row[3]);
    const protein = number(row[4]);
    if (
      !name ||
      kj === null ||
      carbs === null ||
      fat === null ||
      protein === null
    ) {
      result.warnings.push(
        `Custom food ${index + 1} lacks required nutrition and was skipped.`
      );
      continue;
    }
    result.customFoods.push({
      sourceKey: `newitem:${row[6]?.trim() ?? ''}:${name.toLocaleLowerCase('de')}`,
      name,
      brand: row[16]?.trim() ?? '',
      articleNumber: row[6]?.trim() ?? '',
      portions: row[41]?.trim() ?? '',
      calories: Math.round((kj / 4.184) * 1_000_000) / 1_000_000,
      carbs,
      fat,
      protein,
      dietaryFiber: optionalNumber(row[5]),
      sugars: optionalNumber(row[7]),
      caffeine: optionalNumber(row[9]),
      alcoholG: optionalNumber(row[8]),
      cholesterol: optionalNumber(row[10]),
      saturatedFat: optionalNumber(row[14]),
      sodium:
        optionalNumber(row[29]) === undefined
          ? undefined
          : Math.round((optionalNumber(row[29]) ?? 0) * 400_000) / 1_000,
      iron: optionalNumber(row[26]),
      calcium: optionalNumber(row[27]),
      potassium: optionalNumber(row[36]),
      vitaminC: optionalNumber(row[23]),
    });
  }

  const recipeOccurrences = new Map<string, number>();
  for (const [index, row] of (sections.get('lists')?.rows ?? []).entries()) {
    const name = row[0]?.trim() ?? '';
    const servings = number(row[2]);
    const ingredientsText = row[5]?.trim() ?? '';
    if (!name || servings === null || servings <= 0 || !ingredientsText) {
      result.warnings.push(
        `Saved list ${index + 1} is incomplete and was skipped.`
      );
      continue;
    }
    const normalized = name.toLocaleLowerCase('de');
    const occurrence = recipeOccurrences.get(normalized) ?? 0;
    recipeOccurrences.set(normalized, occurrence + 1);
    result.recipes.push({
      sourceKey: `list:${normalized}:${occurrence}`,
      name,
      servings,
      preparationMinutes: number(row[3]) ?? 0,
      cookingMinutes: number(row[4]) ?? 0,
      ingredientsText,
    });
  }

  const favorites = new Set<string>();
  for (const row of sections.get('marker')?.rows ?? []) {
    const name = row[0]?.trim();
    if (name && !favorites.has(name.toLocaleLowerCase('de'))) {
      favorites.add(name.toLocaleLowerCase('de'));
      result.favorites.push(name);
    }
  }

  for (const [index, row] of (
    sections.get('userhistory')?.rows ?? []
  ).entries()) {
    const match = DATE_RE.exec(row[0]?.trim() ?? '');
    const date =
      match && isoDate(match[1] ?? '', match[2] ?? '', match[3] ?? '');
    const weightKg = number(row[1]);
    if (date && weightKg !== null && weightKg > 0) {
      result.measurements.push({ date, weightKg });
    } else {
      result.warnings.push(
        `Weight row ${index + 1} is invalid and was skipped.`
      );
    }
  }
  return result;
};
