import type { TFunction } from 'i18next';
import type {
  CheckinQuestionDefinition,
  DailyCheckinBuiltInTag,
  DailyProgressDomain,
  HealthContextKind,
} from '@workspace/shared';
import type { Daypart } from '../../utils/supplementDay';

// Static lookups so every key is visible to the i18n audit and extraction.

export function checkinTagLabel(
  t: TFunction,
  tag: DailyCheckinBuiltInTag
): string {
  switch (tag) {
    case 'cravings':
      return t('checkin.tags.cravings', { defaultValue: 'Cravings' });
    case 'busy_day':
      return t('checkin.tags.busy_day', { defaultValue: 'Busy day' });
    case 'great_workout':
      return t('checkin.tags.great_workout', { defaultValue: 'Great workout' });
    case 'low_sleep':
      return t('checkin.tags.low_sleep', { defaultValue: 'Low sleep' });
    case 'social_event':
      return t('checkin.tags.social_event', { defaultValue: 'Social event' });
    default:
      return t('checkin.tags.good_routine', { defaultValue: 'Good routine' });
  }
}

export function overallDayLabel(t: TFunction, value: number): string {
  switch (value) {
    case 1:
      return t('checkin.overall.very_difficult', {
        defaultValue: 'Very difficult',
      });
    case 2:
      return t('checkin.overall.difficult', { defaultValue: 'Difficult' });
    case 3:
      return t('checkin.overall.okay', { defaultValue: 'Okay' });
    case 4:
      return t('checkin.overall.good', { defaultValue: 'Good' });
    default:
      return t('checkin.overall.great', { defaultValue: 'Great' });
  }
}

export function checkinQuestionText(
  t: TFunction,
  key: CheckinQuestionDefinition['key']
): { title: string; scale: string } {
  switch (key) {
    case 'energy':
      return {
        title: t('checkin.questions.energy.title', { defaultValue: 'Energy' }),
        scale: t('checkin.questions.energy.scale', {
          defaultValue: '1 very low · 5 very high',
        }),
      };
    case 'stress':
      return {
        title: t('checkin.questions.stress.title', {
          defaultValue: 'Stress level',
        }),
        scale: t('checkin.questions.stress.scale', {
          defaultValue: '1 very little · 5 very stressful',
        }),
      };
    case 'sleep_quality':
      return {
        title: t('checkin.questions.sleep_quality.title', {
          defaultValue: 'Sleep last night',
        }),
        scale: t('checkin.questions.sleep_quality.scale', {
          defaultValue: '1 very poor · 5 very good',
        }),
      };
    case 'nutrition_on_track':
      return {
        title: t('checkin.questions.nutrition_on_track.title', {
          defaultValue: 'Nutrition on track',
        }),
        scale: t('checkin.questions.nutrition_on_track.scale', {
          defaultValue: '1 far off · 5 fully on track',
        }),
      };
    default:
      return {
        title: t('checkin.questions.activity.title', {
          defaultValue: 'Activity / movement',
        }),
        scale: t('checkin.questions.activity.scale', {
          defaultValue: '1 not active · 5 very active',
        }),
      };
  }
}

export function contextKindLabel(
  t: TFunction,
  kind: HealthContextKind
): string {
  if (kind === 'injury')
    return t('context.kind.injury', { defaultValue: 'Injury' });
  if (kind === 'illness')
    return t('context.kind.illness', { defaultValue: 'Illness' });
  return t('context.kind.vacation', { defaultValue: 'Vacation' });
}

export function daypartLabel(t: TFunction, part: Daypart): string {
  switch (part) {
    case 'morning':
      return t('supplements.daypart.morning', { defaultValue: 'Morning' });
    case 'midday':
      return t('supplements.daypart.midday', { defaultValue: 'Midday' });
    case 'evening':
      return t('supplements.daypart.evening', { defaultValue: 'Evening' });
    default:
      return t('supplements.daypart.anytime', { defaultValue: 'Any time' });
  }
}

export function progressDomainLabel(
  t: TFunction,
  domain: DailyProgressDomain
): string {
  switch (domain) {
    case 'checkin':
      return t('progress.domain.checkin', { defaultValue: 'Check-in' });
    case 'habit':
      return t('progress.domain.habit', { defaultValue: 'Habits' });
    case 'measurement':
      return t('progress.domain.measurement', { defaultValue: 'Measurements' });
    case 'goal':
      return t('progress.domain.goal', { defaultValue: 'Daily objectives' });
    case 'workout':
      return t('progress.domain.workout', { defaultValue: 'Planned training' });
    case 'activity':
      return t('activityPlanning.activity', { defaultValue: 'Activity' });
    case 'supplement':
      return t('progress.domain.supplement', { defaultValue: 'Supplements' });
    default:
      return t('progress.domain.meal', { defaultValue: 'Meals' });
  }
}

export function plannedActivityLabel(t: TFunction, value: string): string {
  switch (value) {
    case 'running':
      return t('weeklyPlan.activities.running', { defaultValue: 'Running' });
    case 'strength':
      return t('weeklyPlan.activities.strength', {
        defaultValue: 'Resistance training',
      });
    case 'cycling':
      return t('weeklyPlan.activities.cycling', { defaultValue: 'Cycling' });
    case 'walking':
      return t('weeklyPlan.activities.walking', { defaultValue: 'Walking' });
    case 'hiking':
      return t('weeklyPlan.activities.hiking', { defaultValue: 'Hiking' });
    case 'swimming':
      return t('weeklyPlan.activities.swimming', { defaultValue: 'Swimming' });
    case 'rowing':
      return t('weeklyPlan.activities.rowing', { defaultValue: 'Rowing' });
    case 'soccer':
      return t('weeklyPlan.activities.soccer', { defaultValue: 'Soccer' });
    case 'yoga':
      return t('weeklyPlan.activities.yoga', { defaultValue: 'Yoga' });
    case 'other':
      return t('weeklyPlan.activities.other', {
        defaultValue: 'Other activity',
      });
    case 'rest':
      return t('weeklyPlan.activities.rest', { defaultValue: 'Rest day' });
    default:
      return t('weeklyPlan.activities.other', {
        defaultValue: 'Other activity',
      });
  }
}

export function progressGoalLabel(t: TFunction, value: string): string {
  switch (value) {
    case 'hydration':
      return t('progress.goals.hydration', { defaultValue: 'Hydration goal' });
    case 'activity_duration':
      return t('progress.goals.activity_duration', {
        defaultValue: 'Activity duration goal',
      });
    case 'nutrition_review':
      return t('progress.goals.nutrition_review', {
        defaultValue: 'Review daily nutrition',
      });
    default:
      return value;
  }
}

export function nutritionGoalLabel(t: TFunction, value: string): string {
  switch (value) {
    case 'calories':
      return t('nutrition.calories', { defaultValue: 'calories' });
    case 'protein':
      return t('nutrition.protein', { defaultValue: 'protein' });
    case 'carbs':
      return t('nutrition.carbs', { defaultValue: 'carbs' });
    case 'fat':
      return t('nutrition.fat', { defaultValue: 'fat' });
    default:
      return value;
  }
}
