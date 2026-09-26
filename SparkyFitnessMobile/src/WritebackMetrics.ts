import type { ImageSourcePropType } from 'react-native';

// Writeback metrics (Sparky → OS health store). Kept separate from the read
// HealthMetrics list: those drive background-delivery subscriptions and inbound
// sync, whereas these are outbound and opt-in. Supported on both platforms — Health
// Connect on Android (healthconnect/writeback.ts) and HealthKit on iOS
// (healthkit/writeback.ts), resolved via the top-level ./writeback shim. Off by default.
//
// Mirrors the read metrics' shape (icon + category) so the UI can group them in
// the same accordion style. We start with Nutrition + Hydration; a follow-up PR
// will extend writeback to the other readable metrics (which is why this is a
// category-grouped list rather than a flat pair).

export type WritebackMetricId = 'nutrition' | 'hydration' | 'workout';

/** Inclusive local-calendar-day range (YYYY-MM-DD) for a targeted writeback removal.
 *  `null` removal means "all time" (full purge). */
export interface WritebackDateRange {
  from: string;
  to: string;
}

/** Result of a removal: `ok` is false if any record-type delete failed (partial). */
export interface WritebackRemovalResult {
  ok: boolean;
}

export interface WritebackMetric {
  id: WritebackMetricId;
  defaultLabel: string;
  /** Stable localization key for the application-owned metric label. */
  labelKey: string;
  /** loadHealthPreference/saveHealthPreference key (under the @HealthConnect prefix on
   *  Android, @HealthKit on iOS — the platform-resolved preferences module owns it). */
  preferenceKey: string;
  recordType: 'Nutrition' | 'Hydration' | 'Workout';
  permission: {
    accessType: 'write';
    recordType: 'Nutrition' | 'Hydration' | 'Workout';
  };
  icon: ImageSourcePropType;
  category: string;
}

export const WRITEBACK_METRICS = [
  {
    id: 'nutrition',
    labelKey: 'healthMetrics.nutrition',
    defaultLabel: 'Nutrition',
    preferenceKey: 'writebackNutritionEnabled',
    recordType: 'Nutrition',
    permission: { accessType: 'write', recordType: 'Nutrition' },
    icon: require('../assets/icons/health-metrics/nutrition.png'),
    category: 'Nutrition',
  },
  {
    id: 'hydration',
    labelKey: 'healthMetrics.hydration',
    defaultLabel: 'Hydration',
    preferenceKey: 'writebackHydrationEnabled',
    recordType: 'Hydration',
    permission: { accessType: 'write', recordType: 'Hydration' },
    icon: require('../assets/icons/health-metrics/hydration.png'),
    category: 'Nutrition',
  },
] satisfies WritebackMetric[];

/** iOS-only, event-based export. Kept outside the periodic nutrition/hydration
 * writeback list so a daily sync cannot create or remove workouts. */
export const WORKOUT_EXPORT_METRIC: WritebackMetric = {
  id: 'workout',
  labelKey: 'healthSync.workoutExport',
  defaultLabel: 'Completed workouts',
  preferenceKey: 'writebackWorkoutEnabled',
  recordType: 'Workout',
  permission: { accessType: 'write', recordType: 'Workout' },
  icon: require('../assets/icons/health-metrics/exercise_session.png'),
  category: 'Activity',
};

/** Order categories render in (mirrors the read section's grouping). */
export const WRITEBACK_CATEGORY_ORDER: string[] = ['Nutrition'];
