import { useEffect } from 'react';
import { AppState } from 'react-native';
import { addDays, localDateTimeToUtc, todayInZone } from '@workspace/shared';
import { getDeviceTimezone } from '../utils/dateUtils';

/** Refresh the server's rolling window at account midnight, including after suspension. */
export function useFavoriteDayRefresh(
  refetch: () => Promise<unknown>,
  enabled: boolean,
  accountTimezone?: string | null
) {
  useEffect(() => {
    if (!enabled) return;
    const timezone = accountTimezone || getDeviceTimezone();
    let day = todayInZone(timezone);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const current = todayInZone(timezone);
      if (current !== day) {
        day = current;
        void refetch().catch(() => {
          /* Preserve cached favorites offline. */
        });
      }
      clearTimeout(timer);
      const midnight = localDateTimeToUtc(
        `${addDays(current, 1)}T00:00`,
        timezone
      ).getTime();
      timer = setTimeout(check, Math.max(1000, midnight - Date.now() + 100));
    };
    check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [accountTimezone, enabled, refetch]);
}
