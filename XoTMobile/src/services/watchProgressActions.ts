import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { WatchProgressActionPayload } from '../../modules/watch-connectivity';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { isCurrentWatchActionScope } from './watchActionScope';
import {
  getDailyProgress,
  listHabits,
  logHabit,
  setMealDayStatus,
} from './api/dailyTrackingApi';
import { getTodayDate } from '../utils/dateUtils';

const PREFIX = '@XonTrack/watch-progress-receipt/v1/';
const actionSchema = z.object({
  clientId: z.uuid(),
  scope: z.string().min(1),
  entryDate: z.iso.date(),
  itemId: z.string().min(1).max(200),
  capturedAt: z.iso.datetime({ offset: true }),
  expectedRecordedAt: z.iso.datetime({ offset: true }).nullable(),
});
const receiptSchema = z.object({
  fingerprint: z.string(),
  state: z.enum(['attempted', 'saved']),
  expires: z.number(),
});
let queue: Promise<unknown> = Promise.resolve();

/** No second action outbox: Watch owns delivery; these are conservative replay receipts.
 * Persist intent BEFORE a write. An uncertain response is reconciled by reading,
 * never blindly resubmitted over a subsequent phone undo. */
export function completeWatchProgress(
  payload: WatchProgressActionPayload
): Promise<boolean> {
  const result = queue.then(async () => {
    const parsed = actionSchema.safeParse(payload);
    if (!parsed.success) return false;
    const action = parsed.data;
    const captured = Date.parse(action.capturedAt);
    if (
      action.entryDate !== getTodayDate() ||
      captured > Date.now() + 60_000 ||
      Date.now() - captured > 86_400_000 ||
      !(await isCurrentWatchActionScope(action.scope))
    )
      return false;
    const identity = await getActiveNutritionIdentity();
    if (!identity || !(await isCurrentWatchActionScope(action.scope)))
      return false;
    const key =
      PREFIX + encodeURIComponent(action.scope) + '/' + action.clientId;
    const fingerprint = JSON.stringify([
      action.itemId,
      action.entryDate,
      action.expectedRecordedAt,
      action.capturedAt,
    ]);
    const raw = await AsyncStorage.getItem(key);
    const receipt = raw ? receiptSchema.parse(JSON.parse(raw)) : null;
    if (receipt && receipt.fingerprint !== fingerprint) return false;
    if (receipt?.state === 'saved') return true;
    const progress = await getDailyProgress(action.entryDate, identity);
    const item = progress?.items.find(
      (row) => row.id === action.itemId && row.date === action.entryDate
    );
    if (
      !item ||
      !item.applicable ||
      !item.reference_id ||
      !['habit', 'meal'].includes(item.domain)
    )
      return false;
    const habits =
      item.domain === 'habit' ? await listHabits(false, identity) : [];
    if (
      item.domain === 'habit' &&
      !habits.some(
        (habit) =>
          habit.id === item.reference_id &&
          habit.habit_type === 'completion' &&
          habit.active &&
          habit.category !== 'wellness'
      )
    )
      return false;
    if (item.state === 'excluded') return false;
    if (!(await isCurrentWatchActionScope(action.scope))) return false;
    const saved = JSON.stringify({
      fingerprint,
      state: 'saved',
      expires: Date.now() + 172_800_000,
    });
    if (item.state === 'complete') {
      await AsyncStorage.setItem(key, saved);
      return true;
    }
    // A previous uncertain attempt or changed source needs fresh user confirmation.
    if (receipt || item.recorded_at !== action.expectedRecordedAt) return false;
    // Bounded receipts: expired actions can no longer pass the 24-hour admission gate.
    for (const oldKey of (await AsyncStorage.getAllKeys()).filter((value) =>
      value.startsWith(PREFIX)
    )) {
      const old = await AsyncStorage.getItem(oldKey);
      const record = old ? receiptSchema.safeParse(JSON.parse(old)) : null;
      if (record?.success && record.data.expires < Date.now())
        await AsyncStorage.removeItem(oldKey);
    }
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        fingerprint,
        state: 'attempted',
        expires: Date.now() + 172_800_000,
      })
    );
    if (item.domain === 'habit')
      await logHabit(
        item.reference_id,
        { entry_date: action.entryDate, value: true },
        identity
      );
    else
      await setMealDayStatus(
        {
          entry_date: action.entryDate,
          meal_type_id: item.reference_id,
          status: 'complete',
        },
        identity
      );
    await AsyncStorage.setItem(key, saved);
    return true;
  });
  queue = result.catch(() => undefined);
  return result.catch(() => false);
}
