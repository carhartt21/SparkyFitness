import { useDailySummary, usePreferences } from './index';
import { useMobilityDiary } from './useMobilityDiary';
import { useActivityPlanning } from './useActivityPlanning';
import { isDailyEnergyAggregate } from '../utils/workoutPresentation';

export function useDailyTraining(date: string, enabled: boolean) {
  const daily = useDailySummary({ date, enabled });
  const { preferences } = usePreferences();
  const mobility = useMobilityDiary(date, enabled, preferences?.timezone);
  const planning = useActivityPlanning(date, date, enabled);
  const sessions = (daily.summary?.exerciseEntries ?? []).filter(
    (session) => !isDailyEnergyAggregate(session)
  );
  const mobilityMinutes = mobility.sessions.reduce(
    (total, session) =>
      total +
      (session.endedAt
        ? Math.max(
            0,
            Date.parse(session.endedAt) - Date.parse(session.startedAt)
          ) / 60000
        : 0),
    0
  );
  const minutes =
    sessions.reduce(
      (total, session) =>
        total +
        (session.type === 'preset'
          ? session.total_duration_minutes
          : session.duration_minutes),
      0
    ) + mobilityMinutes;
  const count = sessions.length + mobility.sessions.length;
  const planned = (planning.query.data?.occurrences ?? []).filter(
    (item) => item.state === 'pending' || item.state === 'started'
  );
  const distanceUnit: 'km' | 'miles' =
    preferences?.default_distance_unit === 'miles' ? 'miles' : 'km';
  return {
    distanceUnit,
    daily,
    mobility,
    planning,
    sessions,
    minutes,
    count,
    planned,
    timezone:
      planning.query.data?.timezone ??
      preferences?.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
