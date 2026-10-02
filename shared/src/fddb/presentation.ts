/** FDDB imports are diary snapshots, not an editable meal category. */
export const FDDB_IMPORT_MEAL_TYPE = "FDDB Import";

export function isFddbImportMeal(name: string): boolean {
  return name.trim().toLowerCase() === FDDB_IMPORT_MEAL_TYPE.toLowerCase();
}

/** Entry presence, rather than calories, determines whether the card exists. */
export function shouldShowDiaryMeal(name: string, entryCount: number): boolean {
  return !isFddbImportMeal(name) || entryCount > 0;
}
