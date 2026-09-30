import { setMockDataContext } from '../../utils/mockDataContext.js';
import axios from 'axios';
import { getSystemClient } from '../../db/poolManager.js';
import { decrypt, ENCRYPTION_KEY } from '../../security/encryption.js';
import { log } from '../../config/logging.js';
import { loadRawBundle } from '../../utils/diagnosticLogger.js';
import hevyDataProcessor from './hevyDataProcessor.js';
import type {
  HevyRoutine,
  HevyWorkout,
  HevyWorkoutImportResult,
} from './hevyDataProcessor.js';
import { loadUserTimezone } from '../../utils/timezoneLoader.js';
import {
  todayInZone,
  addDays,
  dayToUtcRange,
  dayRangeToUtcRange,
  isDayString,
} from '@workspace/shared';
import { logRawResponse } from '../../utils/diagnosticLogger.js';
import { isValidHevyInstant } from './hevyTimestamp.js';

const HEVY_API_BASE_URL = 'https://api.hevyapp.com';

function emptyImportResult(): HevyWorkoutImportResult {
  return { imported: 0, skipped: 0, failed: [] };
}

function isUsableHevyItem(item: unknown): item is HevyWorkout | HevyRoutine {
  if (!item || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim() === '') return false;
  const exercises = record.exercises;
  if (exercises === null || exercises === undefined) return true;
  if (!Array.isArray(exercises)) return false;
  return exercises.every((exercise: unknown) => {
    if (!exercise || typeof exercise !== 'object') return false;
    const sets = (exercise as Record<string, unknown>).sets;
    return (
      sets === null ||
      sets === undefined ||
      (Array.isArray(sets) &&
        sets.every((set: unknown) => set !== null && typeof set === 'object'))
    );
  });
}

function usableHevyItems<T extends HevyWorkout | HevyRoutine>(
  items: unknown[],
  resource: 'workouts' | 'routines',
  pageKey: string,
  warnings: string[]
): T[] {
  const usable: T[] = [];
  let rejected = 0;
  for (const item of items) {
    if (isUsableHevyItem(item)) usable.push(item as T);
    else rejected++;
  }
  if (rejected > 0) {
    warnings.push(`Invalid Hevy ${resource} items in ${pageKey}: ${rejected}`);
  }
  return usable;
}

function syncOutcome(
  workouts: HevyWorkoutImportResult,
  routines: HevyWorkoutImportResult,
  fetchWarnings: string[]
) {
  const partial =
    workouts.failed.length > 0 ||
    routines.failed.length > 0 ||
    fetchWarnings.length > 0;
  return { success: !partial, partial, workouts, routines, fetchWarnings };
}

async function processUserInfoSafely(
  userId: string,
  createdByUserId: string,
  data: Parameters<typeof hevyDataProcessor.processHevyUserInfo>[2],
  timezone: string,
  warnings: string[]
): Promise<void> {
  try {
    await hevyDataProcessor.processHevyUserInfo(
      userId,
      createdByUserId,
      data,
      timezone
    );
  } catch (error) {
    warnings.push('Failed to process Hevy user measurements');
    log(
      'warn',
      `[hevyService] Hevy user measurements failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function numberedRawPageKeys(
  responses: Record<string, unknown>,
  prefix: string
): string[] {
  return Object.keys(responses)
    .filter((key) => {
      const suffix = key.slice(prefix.length);
      return key.startsWith(prefix) && /^[1-9]\d*$/.test(suffix);
    })
    .sort(
      (left, right) =>
        Number(left.slice(prefix.length)) - Number(right.slice(prefix.length))
    );
}

/**
 * Get the Hevy API key for a specific provider instance.
 * @param {string} userId - The Sparky Fitness user ID.
 * @param {string} providerId - The specific provider ID (optional but recommended).
 * @returns {Promise<string>} - The decrypted API key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getHevyApiKey(userId: any, providerId: any) {
  const client = await getSystemClient();
  try {
    let query = `SELECT encrypted_app_key, app_key_iv, app_key_tag
                 FROM external_data_providers
                 WHERE user_id = $1 AND provider_type = 'hevy'`;
    const params = [userId];
    if (providerId) {
      query += ' AND id = $2';
      params.push(providerId);
    } else {
      // If no providerId, prefer active ones
      query += ' ORDER BY is_active DESC, created_at DESC LIMIT 1';
    }
    const result = await client.query(query, params);
    if (result.rows.length === 0) {
      throw new Error('Hevy provider not found.');
    }
    const { encrypted_app_key, app_key_iv, app_key_tag } = result.rows[0];
    if (!encrypted_app_key) {
      throw new Error('Hevy API key is missing for this provider.');
    }
    return decrypt(encrypted_app_key, app_key_iv, app_key_tag, ENCRYPTION_KEY!);
  } finally {
    client.release();
  }
}

/**
 * Helper to get a hevy provider ID for a user.
 * @param {string} userId
 * @returns {Promise<string>}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getHevyProviderId(userId: any) {
  const client = await getSystemClient();
  try {
    const result = await client.query(
      `SELECT id FROM external_data_providers
             WHERE user_id = $1 AND provider_type = 'hevy'
             ORDER BY is_active DESC, created_at DESC LIMIT 1`,
      [userId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    return null;
  } finally {
    client.release();
  }
}

async function markHevyProviderSynced(userId: string, providerId?: string) {
  const selectedId = providerId || (await getHevyProviderId(userId));
  if (!selectedId) return;
  const client = await getSystemClient();
  try {
    await client.query(
      `UPDATE external_data_providers
       SET last_sync_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND provider_type = 'hevy'`,
      [selectedId, userId]
    );
  } finally {
    client.release();
  }
}
/**
 * Fetch user info from Hevy.
 * @param {string} userId - The Sparky Fitness user ID.
 * @returns {Promise<Object>} - The Hevy user info.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserInfo(userId: any, providerId: any) {
  const apiKey = await getHevyApiKey(userId, providerId);
  try {
    const response = await axios.get(`${HEVY_API_BASE_URL}/v1/user/info`, {
      headers: { 'api-key': apiKey },
    });
    logRawResponse('hevy', 'raw_user_info', response.data);
    return response.data;
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error fetching Hevy user info for user ${userId}: ${error.message}`
    );
    throw error;
  }
}
/**
 * Fetch workouts from Hevy.
 * @param {string} userId - The Sparky Fitness user ID.
 * @param {number} page - The page number.
 * @param {number} pageSize - The number of workouts per page.
 * @returns {Promise<Object>} - The paginated workouts.
 */

async function getWorkouts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  page = 1,
  pageSize = 10,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerId: any
) {
  const apiKey = await getHevyApiKey(userId, providerId);
  try {
    const response = await axios.get(`${HEVY_API_BASE_URL}/v1/workouts`, {
      headers: { 'api-key': apiKey },
      params: { page, pageSize },
    });
    logRawResponse('hevy', 'raw_workouts_page', response.data);
    return response.data;
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error fetching Hevy workouts for user ${userId}: ${error.message}`
    );
    throw error;
  }
}
/**
 * Fetch exercise templates from Hevy.
 * @param {string} userId - The Sparky Fitness user ID.
 * @param {number} page - The page number.
 * @param {number} pageSize - The number of templates per page.
 * @returns {Promise<Object>} - The paginated exercise templates.
 */
async function getExerciseTemplates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  page = 1,
  pageSize = 10,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerId: any
) {
  const apiKey = await getHevyApiKey(userId, providerId);
  try {
    const response = await axios.get(
      `${HEVY_API_BASE_URL}/v1/exercise_templates`,
      {
        headers: { 'api-key': apiKey },
        params: { page, pageSize },
      }
    );
    logRawResponse('hevy', 'raw_exercise_templates_page', response.data);
    return response.data;
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error fetching Hevy exercise templates for user ${userId}: ${error.message}`
    );
    throw error;
  }
}
/** Fetch saved routines separately from completed workout history. */
async function getRoutines(
  userId: string,
  page = 1,
  pageSize = 10,
  providerId?: string
) {
  const apiKey = await getHevyApiKey(userId, providerId);
  const response = await axios.get(`${HEVY_API_BASE_URL}/v1/routines`, {
    headers: { 'api-key': apiKey },
    params: { page, pageSize },
  });
  logRawResponse('hevy', 'raw_routines_page', response.data);
  return response.data;
}
/**
 * Synchronize Hevy data for a user.
 * @param {string} userId - The Sparky Fitness user ID.
 * @param {string} createdByUserId - The user ID who triggered the sync.
 * @param {boolean} fullSync - Whether to fetch all history or just recent.
 * @param {string} providerId - Optional provider ID.
 * @param {string} [startDate] - Optional custom start date (YYYY-MM-DD).
 * @param {string} [endDate] - Optional custom end date (YYYY-MM-DD).
 * @returns {Promise<Object>} - The result of the synchronization.
 */
async function syncHevyData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdByUserId: any,
  fullSync = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerId: any,
  startDate: string | null = null,
  endDate: string | null = null,
  dataSource: string | null = null,
  saveMockData = false
) {
  const tz = await loadUserTimezone(userId);
  const hevyDataSource = dataSource || 'hevy';
  const hasDateRange = startDate !== null || endDate !== null;
  if (
    hasDateRange &&
    (!startDate ||
      !endDate ||
      !isDayString(startDate) ||
      !isDayString(endDate) ||
      startDate > endDate)
  ) {
    throw new Error('Invalid Hevy sync date range');
  }
  setMockDataContext({ dataSource, saveMockData });
  log(
    'info',
    `Starting Hevy ${fullSync ? 'FULL' : 'INCREMENTAL'} synchronization for user ${userId}${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}... Loading from: ${hevyDataSource}`
  );
  if (hevyDataSource === 'local') {
    log(
      'info',
      `[hevyService] Replaying Hevy sync from raw diagnostic bundle for user ${userId}`
    );
    const bundle = loadRawBundle('hevy');
    if (!bundle || !bundle.responses) {
      throw new Error(
        'Raw diagnostic bundle not found. Run a sync with "Sync and save ' +
          'this sync\'s raw responses" selected first to capture one.'
      );
    }
    const responses = bundle.responses;
    try {
      log('debug', `[hevyService] Processing raw data for ${userId}...`);
      const fetchWarnings: string[] = [];
      // 1. Process user info
      if (responses['raw_user_info']) {
        await processUserInfoSafely(
          userId,
          createdByUserId,
          responses['raw_user_info'].data,
          tz,
          fetchWarnings
        );
      }
      // 2. Process workouts (Look for all pages)
      const allWorkouts: HevyWorkout[] = [];
      const workoutPageKeys = numberedRawPageKeys(
        responses,
        'raw_workouts_page_'
      );
      if (workoutPageKeys.length === 0) {
        fetchWarnings.push('Raw Hevy bundle has no workouts page');
      }
      workoutPageKeys.forEach((key, index) => {
        const pageNumber = Number(key.slice('raw_workouts_page_'.length));
        if (pageNumber !== index + 1) {
          fetchWarnings.push(`Missing Hevy workouts page before ${key}`);
        }
        const pageData = responses[key]?.data;
        if (Array.isArray(pageData?.workouts)) {
          allWorkouts.push(
            ...usableHevyItems<HevyWorkout>(
              pageData.workouts,
              'workouts',
              key,
              fetchWarnings
            )
          );
          const pageCount: unknown = pageData.page_count;
          if (
            pageData.workouts.length > 0 &&
            (typeof pageCount !== 'number' ||
              !Number.isInteger(pageCount) ||
              pageCount < pageNumber)
          ) {
            fetchWarnings.push(`Invalid Hevy workouts pagination: ${key}`);
          } else if (
            typeof pageCount === 'number' &&
            pageCount > pageNumber &&
            index === workoutPageKeys.length - 1
          ) {
            fetchWarnings.push(`Missing Hevy workouts page after ${key}`);
          }
        } else {
          fetchWarnings.push(`Invalid Hevy workouts page: ${key}`);
        }
      });
      const workoutResult =
        allWorkouts.length > 0
          ? await hevyDataProcessor.processHevyWorkouts(
              userId,
              createdByUserId,
              allWorkouts,
              tz
            )
          : emptyImportResult();
      const allRoutines: unknown[] = [];
      const routinePageKeys = numberedRawPageKeys(
        responses,
        'raw_routines_page_'
      );
      if (routinePageKeys.length === 0) {
        fetchWarnings.push('Raw Hevy bundle has no routines page');
      }
      routinePageKeys.forEach((key, index) => {
        const pageNumber = Number(key.slice('raw_routines_page_'.length));
        if (pageNumber !== index + 1) {
          fetchWarnings.push(`Missing Hevy routines page before ${key}`);
        }
        const pageData = responses[key]?.data;
        if (Array.isArray(pageData?.routines)) {
          allRoutines.push(
            ...usableHevyItems<HevyRoutine>(
              pageData.routines,
              'routines',
              key,
              fetchWarnings
            )
          );
          const pageCount: unknown = pageData.page_count;
          if (
            pageData.routines.length > 0 &&
            (typeof pageCount !== 'number' ||
              !Number.isInteger(pageCount) ||
              pageCount < pageNumber)
          ) {
            fetchWarnings.push(`Invalid Hevy routines pagination: ${key}`);
          } else if (
            typeof pageCount === 'number' &&
            pageCount > pageNumber &&
            index === routinePageKeys.length - 1
          ) {
            fetchWarnings.push(`Missing Hevy routines page after ${key}`);
          }
        } else {
          fetchWarnings.push(`Invalid Hevy routines page: ${key}`);
        }
      });
      const routineResult =
        allRoutines.length > 0
          ? await hevyDataProcessor.processHevyRoutines(
              userId,
              createdByUserId,
              allRoutines as Parameters<
                typeof hevyDataProcessor.processHevyRoutines
              >[2]
            )
          : emptyImportResult();
      const outcome = syncOutcome(workoutResult, routineResult, fetchWarnings);
      // 3. Update last sync time
      if (!outcome.partial) {
        await markHevyProviderSynced(userId, providerId);
      }
      log(
        'info',
        `[hevyService] Hevy sync from raw bundle completed for user ${userId}.`
      );
      return {
        ...outcome,
        processedCount: allWorkouts.length,
        source: 'local_raw_replay',
        bundle_updated: bundle.last_updated,
      };
    } catch (error) {
      log(
        'error',
        `[hevyService] Error replaying Hevy data from raw bundle for user ${userId}:`,
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        error.message
      );
      throw error;
    }
  }
  try {
    const fetchWarnings: string[] = [];
    // Helper to safely fetch and log raw data without stopping the whole sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function safeFetch(dataType: any, fetchFn: any) {
      try {
        const data = await fetchFn();
        if (data === null || data === undefined) {
          fetchWarnings.push(`Empty response for ${dataType}`);
          return null;
        }
        logRawResponse('hevy', dataType, data);
        return data;
      } catch (error) {
        fetchWarnings.push(`Failed to fetch ${dataType}`);
        log(
          'warn',
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          `[hevyService] Failed to fetch ${dataType} for user ${userId}: ${error.message}`
        );
        return null;
      }
    }
    // 1. Fetch EVERYTHING first (The Safe Phase)
    log('debug', '[hevyService] Phase 1: Capturing raw API responses...');
    const userInfoData = await safeFetch('raw_user_info', () =>
      getUserInfo(userId, providerId)
    );
    const allWorkouts: HevyWorkout[] = [];
    let currentPage = 1;
    let hasMore = true;
    const requestedRange =
      startDate && endDate ? dayRangeToUtcRange(startDate, endDate, tz) : null;
    const sevenDaysAgoStr = addDays(todayInZone(tz), -7);
    const { start: sevenDaysAgo } = dayToUtcRange(sevenDaysAgoStr, tz);
    while (hasMore) {
      const pageKey = `raw_workouts_page_${currentPage}`;
      const workoutPageData = await safeFetch(pageKey, () =>
        getWorkouts(userId, currentPage, 10, providerId)
      );
      if (!workoutPageData) {
        hasMore = false;
        break;
      }
      if (!Array.isArray(workoutPageData.workouts)) {
        fetchWarnings.push(`Invalid Hevy workouts page: ${pageKey}`);
        hasMore = false;
        break;
      }
      if (workoutPageData.workouts.length === 0) {
        const pageCount: unknown = workoutPageData.page_count;
        if (typeof pageCount === 'number' && pageCount > currentPage) {
          fetchWarnings.push(
            `Empty Hevy workouts page before the last page: ${pageKey}`
          );
        }
        hasMore = false;
        break;
      }
      const workouts = usableHevyItems<HevyWorkout>(
        workoutPageData.workouts,
        'workouts',
        pageKey,
        fetchWarnings
      );
      allWorkouts.push(...workouts);
      const pageCount: unknown = workoutPageData.page_count;
      if (
        typeof pageCount !== 'number' ||
        !Number.isInteger(pageCount) ||
        pageCount < currentPage
      ) {
        fetchWarnings.push(`Invalid Hevy workouts pagination: ${pageKey}`);
        break;
      }
      // Decision to continue
      if (fullSync || requestedRange) {
        hasMore = currentPage < pageCount;
        currentPage++;
      } else {
        // A rejected item may have been the newest one. Fetch the remaining
        // pages rather than guessing that the incremental window is complete.
        const hasRejectedItems =
          workouts.length !== workoutPageData.workouts.length;
        const hasInvalidStartTime = workouts.some(
          (workout) => !isValidHevyInstant(workout.start_time)
        );
        if (hasInvalidStartTime) {
          fetchWarnings.push(`Invalid Hevy workout start time in ${pageKey}`);
        }
        const newestWorkout = workouts[0];
        if (hasRejectedItems || hasInvalidStartTime) {
          hasMore = currentPage < pageCount;
        } else if (newestWorkout) {
          const newestTime = new Date(newestWorkout.start_time);
          hasMore = newestTime >= sevenDaysAgo && currentPage < pageCount;
        } else {
          hasMore = false;
        }
        currentPage++;
      }
    }
    // Saved routines are a separate resource and must be fetched even on an
    // incremental workout sync. They have no workout start date to filter by.
    const allRoutines = [];
    currentPage = 1;
    hasMore = true;
    while (hasMore) {
      const routinePageData = await safeFetch(
        `raw_routines_page_${currentPage}`,
        () => getRoutines(userId, currentPage, 10, providerId)
      );
      if (!routinePageData) break;
      if (!Array.isArray(routinePageData.routines)) {
        fetchWarnings.push(
          `Invalid Hevy routines page: raw_routines_page_${currentPage}`
        );
        break;
      }
      if (routinePageData.routines.length === 0) {
        const pageCount: unknown = routinePageData.page_count;
        if (typeof pageCount === 'number' && pageCount > currentPage) {
          fetchWarnings.push(
            `Empty Hevy routines page before the last page: raw_routines_page_${currentPage}`
          );
        }
        break;
      }
      allRoutines.push(
        ...usableHevyItems<HevyRoutine>(
          routinePageData.routines,
          'routines',
          `raw_routines_page_${currentPage}`,
          fetchWarnings
        )
      );
      const pageCount: unknown = routinePageData.page_count;
      if (
        typeof pageCount !== 'number' ||
        !Number.isInteger(pageCount) ||
        pageCount < currentPage
      ) {
        fetchWarnings.push(
          `Invalid Hevy routines pagination: raw_routines_page_${currentPage}`
        );
        break;
      }
      hasMore = currentPage < pageCount;
      currentPage++;
    }
    // 2. Process EVERYTHING second (The Action Phase)
    log('debug', '[hevyService] Phase 2: Processing captured data...');
    if (userInfoData) {
      await processUserInfoSafely(
        userId,
        createdByUserId,
        userInfoData,
        tz,
        fetchWarnings
      );
    }
    // Hevy has no calendar-day query for workouts. Fetch every page for an
    // explicit range, then select by the user's local-day UTC boundaries.
    // Keep malformed timestamps for the processor to report as failures.
    const selectedWorkouts = requestedRange
      ? allWorkouts.filter((workout) => {
          if (!isValidHevyInstant(workout.start_time)) return true;
          const startedAt = new Date(workout.start_time).getTime();
          return (
            !Number.isFinite(startedAt) ||
            (startedAt >= requestedRange.start.getTime() &&
              startedAt < requestedRange.end.getTime())
          );
        })
      : allWorkouts;
    const workoutResult =
      selectedWorkouts.length > 0
        ? await hevyDataProcessor.processHevyWorkouts(
            userId,
            createdByUserId,
            selectedWorkouts,
            tz
          )
        : emptyImportResult();
    const routineResult =
      allRoutines.length > 0
        ? await hevyDataProcessor.processHevyRoutines(
            userId,
            createdByUserId,
            allRoutines
          )
        : emptyImportResult();
    const outcome = syncOutcome(workoutResult, routineResult, fetchWarnings);
    const totalProcessed = selectedWorkouts.length;
    // 3. Update last sync time
    if (!outcome.partial) {
      await markHevyProviderSynced(userId, providerId);
    }
    log(
      'info',
      `Hevy synchronization completed for user ${userId}. Total processed: ${totalProcessed}`
    );
    return {
      ...outcome,
      processedCount: totalProcessed,
      source: 'live_api',
    };
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Hevy synchronization failed for user ${userId}: ${error.message}`
    );
    throw error;
  }
}
/**
 * Get status of Hevy integration for a user.
 * @param {string} userId - The Sparky Fitness user ID.
 * @returns {Promise<Object>} - The status info.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStatus(userId: any) {
  const client = await getSystemClient();
  try {
    const result = await client.query(
      `SELECT is_active, last_sync_at
             FROM external_data_providers
             WHERE user_id = $1 AND provider_type = 'hevy'`,
      [userId]
    );
    if (result.rows.length === 0) {
      return { connected: false, lastSyncAt: null };
    }
    const { is_active, last_sync_at } = result.rows[0];
    return {
      connected: is_active,
      lastSyncAt: last_sync_at,
    };
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error getting Hevy status for user ${userId}: ${error.message}`
    );
    throw error;
  } finally {
    client.release();
  }
}
export { getUserInfo };
export { getWorkouts };
export { getExerciseTemplates };
export { getRoutines };
export { syncHevyData };
export { getStatus };
export default {
  getUserInfo,
  getWorkouts,
  getExerciseTemplates,
  getRoutines,
  syncHevyData,
  getStatus,
};
