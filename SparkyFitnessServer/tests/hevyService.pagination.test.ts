import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../db/poolManager.js', () => ({
  getSystemClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({
      rows: [
        {
          encrypted_app_key: 'encrypted',
          app_key_iv: 'iv',
          app_key_tag: 'tag',
        },
      ],
    }),
    release: vi.fn(),
  }),
}));
vi.mock('../security/encryption.js', () => ({
  decrypt: vi.fn().mockReturnValue('test-key'),
  ENCRYPTION_KEY: 'test-encryption-key',
}));
vi.mock('../utils/diagnosticLogger.js', () => ({
  logRawResponse: vi.fn(),
  loadRawBundle: vi.fn(),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('Europe/Berlin'),
}));
vi.mock('../integrations/hevy/hevyDataProcessor.js', () => ({
  default: {
    processHevyUserInfo: vi.fn().mockResolvedValue(undefined),
    processHevyWorkouts: vi
      .fn()
      .mockResolvedValue({ imported: 0, skipped: 0, failed: [] }),
    processHevyRoutines: vi
      .fn()
      .mockResolvedValue({ imported: 0, skipped: 0, failed: [] }),
  },
}));

import axios from 'axios';
import {
  getRoutines,
  getWorkouts,
  syncHevyData,
} from '../integrations/hevy/hevyService.js';
import hevyDataProcessor from '../integrations/hevy/hevyDataProcessor.js';
import { getSystemClient } from '../db/poolManager.js';
import { loadRawBundle } from '../utils/diagnosticLogger.js';

beforeEach(() => vi.clearAllMocks());

describe('Hevy paginated API requests', () => {
  it('uses documented pageSize for workout history', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { workouts: [] } });
    await getWorkouts('user-1', 2, 10, 'provider-1');
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.hevyapp.com/v1/workouts',
      expect.objectContaining({ params: { page: 2, pageSize: 10 } })
    );
  });

  it('fetches saved routines from their separate endpoint', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { routines: [] } });
    await getRoutines('user-1', 1, 10, 'provider-1');
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.hevyapp.com/v1/routines',
      expect.objectContaining({ params: { page: 1, pageSize: 10 } })
    );
  });
});

describe('Hevy sync outcomes', () => {
  it('keeps valid records from a live page with malformed items and reports a partial sync', async () => {
    const workout = {
      id: 'workout-1',
      start_time: '2026-09-24T10:00:00.000Z',
      exercises: [],
    };
    const routine = { id: 'routine-1', title: 'A', exercises: [] };
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts')) {
        return {
          data: {
            workouts: [null, workout, { title: 'missing id' }],
            page_count: 1,
          },
        };
      }
      return {
        data: {
          routines: [routine, { id: 'bad-routine', exercises: [null] }],
          page_count: 1,
        },
      };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      processedCount: 1,
      fetchWarnings: [
        'Invalid Hevy workouts items in raw_workouts_page_1: 2',
        'Invalid Hevy routines items in raw_routines_page_1: 1',
      ],
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [workout],
      'Europe/Berlin'
    );
    expect(hevyDataProcessor.processHevyRoutines).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [routine]
    );
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('keeps valid records from a raw replay with malformed items', async () => {
    const workout = { id: 'workout-1', exercises: [] };
    const routine = { id: 'routine-1', title: 'A', exercises: [] };
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page_1: {
          data: {
            workouts: [workout, { id: 'bad-workout', exercises: [null] }],
            page_count: 1,
          },
        },
        raw_routines_page_1: {
          data: { routines: [null, routine], page_count: 1 },
        },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      processedCount: 1,
      fetchWarnings: [
        'Invalid Hevy workouts items in raw_workouts_page_1: 1',
        'Invalid Hevy routines items in raw_routines_page_1: 1',
      ],
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [workout],
      'Europe/Berlin'
    );
    expect(hevyDataProcessor.processHevyRoutines).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [routine]
    );
  });

  it('checks later incremental pages when an earlier page contains an invalid workout', async () => {
    const olderWorkout = {
      id: 'older-workout',
      start_time: '2020-01-01T10:00:00.000Z',
    };
    const laterWorkout = {
      id: 'later-workout',
      start_time: '2026-09-24T10:00:00.000Z',
    };
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts')) {
        const page = (config?.params as { page?: number } | undefined)?.page;
        return {
          data:
            page === 1
              ? { workouts: [null, olderWorkout], page_count: 2 }
              : { workouts: [laterWorkout], page_count: 2 },
        };
      }
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      processedCount: 2,
      fetchWarnings: ['Invalid Hevy workouts items in raw_workouts_page_1: 1'],
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [olderWorkout, laterWorkout],
      'Europe/Berlin'
    );
  });

  it('checks later incremental pages when a workout start time has no offset', async () => {
    const ambiguousWorkout = {
      id: 'ambiguous-workout',
      start_time: '2026-09-24T10:00:00',
    };
    const olderWorkout = {
      id: 'older-workout',
      start_time: '2020-01-01T10:00:00.000Z',
    };
    const laterWorkout = {
      id: 'later-workout',
      start_time: '2026-09-24T10:00:00.000Z',
    };
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts')) {
        const page = (config?.params as { page?: number } | undefined)?.page;
        return {
          data:
            page === 1
              ? { workouts: [ambiguousWorkout, olderWorkout], page_count: 2 }
              : { workouts: [laterWorkout], page_count: 2 },
        };
      }
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      processedCount: 3,
      fetchWarnings: ['Invalid Hevy workout start time in raw_workouts_page_1'],
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [ambiguousWorkout, olderWorkout, laterWorkout],
      'Europe/Berlin'
    );
  });

  it('keeps a failed user measurement visible as a partial live sync', async () => {
    const workout = {
      id: 'workout-1',
      start_time: new Date().toISOString(),
    };
    const routine = { id: 'routine-1', title: 'A', exercises: [] };
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info')) {
        return { data: { user: { weight_kg: 80 } } };
      }
      if (String(url).endsWith('/v1/workouts')) {
        return { data: { workouts: [workout], page_count: 1 } };
      }
      return { data: { routines: [routine], page_count: 1 } };
    });
    vi.mocked(hevyDataProcessor.processHevyUserInfo).mockRejectedValueOnce(
      new Error('measurement write failed')
    );

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Failed to process Hevy user measurements'],
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [workout],
      'Europe/Berlin'
    );
    expect(hevyDataProcessor.processHevyRoutines).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [routine]
    );
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('keeps a failed user measurement visible as a partial raw replay', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_user_info: { data: { user: { weight_kg: 80 } } },
        raw_workouts_page_1: { data: { workouts: [] } },
        raw_routines_page_1: { data: { routines: [] } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });
    vi.mocked(hevyDataProcessor.processHevyUserInfo).mockRejectedValueOnce(
      new Error('measurement write failed')
    );

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Failed to process Hevy user measurements'],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('applies an explicit workout date range in the user timezone and still syncs saved routines', async () => {
    const nextLocalDay = {
      id: 'next-day',
      start_time: '2026-09-23T22:30:00.000Z',
    };
    const lateSelectedDay = {
      id: 'selected-late',
      start_time: '2026-09-23T21:30:00.000Z',
    };
    const earlySelectedDay = {
      id: 'selected-early',
      start_time: '2026-09-22T22:30:00.000Z',
    };
    const previousLocalDay = {
      id: 'previous-day',
      start_time: '2026-09-22T21:30:00.000Z',
    };
    vi.mocked(axios.get).mockImplementation(async (url, config) => {
      if (String(url).endsWith('/v1/user/info')) {
        return { data: { user: null } };
      }
      if (String(url).endsWith('/v1/workouts')) {
        const params = config?.params as { page?: number } | undefined;
        return {
          data: {
            workouts:
              params?.page === 1
                ? [nextLocalDay, lateSelectedDay]
                : [earlySelectedDay, previousLocalDay],
            page_count: 2,
          },
        };
      }
      return {
        data: {
          routines: [{ id: 'saved-routine-1', title: 'A', exercises: [] }],
          page_count: 1,
        },
      };
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      '2026-09-23',
      '2026-09-23'
    );

    expect(result).toMatchObject({
      success: true,
      partial: false,
      processedCount: 2,
    });
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.hevyapp.com/v1/workouts',
      expect.objectContaining({ params: { page: 2, pageSize: 10 } })
    );
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [lateSelectedDay, earlySelectedDay],
      'Europe/Berlin'
    );
    expect(hevyDataProcessor.processHevyRoutines).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [{ id: 'saved-routine-1', title: 'A', exercises: [] }]
    );
  });

  it('marks only the selected user-owned Hevy connection after a complete live sync', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info')) {
        return { data: { user: null } };
      }
      if (String(url).endsWith('/v1/workouts')) {
        return { data: { workouts: [] } };
      }
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({ success: true, partial: false });
    const client = await getSystemClient();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE id = $1 AND user_id = $2 AND provider_type = 'hevy'"
      ),
      ['provider-1', 'user-1']
    );
  });

  it('scopes raw-replay sync timestamps to the selected connection too', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page_1: { data: { workouts: [] } },
        raw_routines_page_1: { data: { routines: [] } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({ success: true, partial: false });
    const client = await getSystemClient();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE id = $1 AND user_id = $2 AND provider_type = 'hevy'"
      ),
      ['provider-1', 'user-1']
    );
  });

  it('reports a failed saved routine without marking the provider fully synced', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts'))
        return { data: { workouts: [] } };
      return {
        data: {
          routines: [{ id: 'routine-1', title: 'A', exercises: [] }],
          page_count: 1,
        },
      };
    });
    vi.mocked(hevyDataProcessor.processHevyRoutines).mockResolvedValueOnce({
      imported: 0,
      skipped: 0,
      failed: [{ id: 'routine-1', message: 'preset write failed' }],
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      routines: { imported: 0, failed: [{ id: 'routine-1' }] },
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('reports a routine-page fetch failure instead of claiming a complete sync', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts'))
        return { data: { workouts: [] } };
      throw new Error('API unavailable');
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Failed to fetch raw_routines_page_1'],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('treats a malformed workout page as partial instead of an empty history', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts'))
        return { data: { error: 'unexpected response' } };
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Invalid Hevy workouts page: raw_workouts_page_1'],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('treats a null workout response as partial', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info')) {
        return { data: { user: null } };
      }
      if (String(url).endsWith('/v1/workouts')) {
        return { data: null };
      }
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Empty response for raw_workouts_page_1'],
    });
  });

  it('treats a malformed saved-routine page as partial', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info'))
        return { data: { user: null } };
      if (String(url).endsWith('/v1/workouts'))
        return { data: { workouts: [] } };
      return { data: { error: 'unexpected response' } };
    });

    const result = await syncHevyData('user-1', 'user-1', false, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Invalid Hevy routines page: raw_routines_page_1'],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it.each([
    ['workouts', 'raw_workouts_page_1'],
    ['routines', 'raw_routines_page_1'],
  ] as const)(
    'does not call a nonempty %s page the last page without valid pagination',
    async (resource, pageKey) => {
      vi.mocked(axios.get).mockImplementation(async (url) => {
        if (String(url).endsWith('/v1/user/info')) {
          return { data: { user: null } };
        }
        if (String(url).endsWith('/v1/workouts')) {
          return {
            data:
              resource === 'workouts'
                ? { workouts: [{ id: 'workout-1' }] }
                : { workouts: [] },
          };
        }
        return {
          data:
            resource === 'routines'
              ? { routines: [{ id: 'routine-1' }] }
              : { routines: [] },
        };
      });

      const result = await syncHevyData('user-1', 'user-1', true, 'provider-1');

      expect(result).toMatchObject({
        success: false,
        partial: true,
        fetchWarnings: [`Invalid Hevy ${resource} pagination: ${pageKey}`],
      });
      const client = await getSystemClient();
      expect(client.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE external_data_providers'),
        expect.anything()
      );
    }
  );

  it('treats an empty page before its reported last page as partial', async () => {
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/user/info')) {
        return { data: { user: null } };
      }
      if (String(url).endsWith('/v1/workouts')) {
        return { data: { workouts: [], page_count: 2 } };
      }
      return { data: { routines: [] } };
    });

    const result = await syncHevyData('user-1', 'user-1', true, 'provider-1');

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: [
        'Empty Hevy workouts page before the last page: raw_workouts_page_1',
      ],
    });
  });

  it('treats malformed raw-replay pages as partial', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page_1: { data: { error: 'unexpected response' } },
        raw_routines_page_1: { data: { error: 'unexpected response' } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: [
        'Invalid Hevy workouts page: raw_workouts_page_1',
        'Invalid Hevy routines page: raw_routines_page_1',
      ],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('does not mark an empty diagnostic bundle as a complete replay', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {},
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: [
        'Raw Hevy bundle has no workouts page',
        'Raw Hevy bundle has no routines page',
      ],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('ignores the generic latest-page copy in a raw diagnostic replay', async () => {
    const workout = { id: 'workout-1' };
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page: { data: { workouts: [workout], page_count: 1 } },
        raw_workouts_page_1: { data: { workouts: [workout], page_count: 1 } },
        raw_routines_page: { data: { routines: [] } },
        raw_routines_page_1: { data: { routines: [] } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: true,
      partial: false,
      processedCount: 1,
    });
    expect(hevyDataProcessor.processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [workout],
      'Europe/Berlin'
    );
  });

  it('marks a raw replay partial when a captured page is missing', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page_1: {
          data: { workouts: [{ id: 'workout-1' }], page_count: 2 },
        },
        raw_routines_page_1: { data: { routines: [] } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Missing Hevy workouts page after raw_workouts_page_1'],
    });
    const client = await getSystemClient();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE external_data_providers'),
      expect.anything()
    );
  });

  it('detects a gap between numbered raw workout pages', async () => {
    vi.mocked(loadRawBundle).mockReturnValueOnce({
      responses: {
        raw_workouts_page_1: {
          data: { workouts: [{ id: 'workout-1' }], page_count: 3 },
        },
        raw_workouts_page_3: {
          data: { workouts: [{ id: 'workout-3' }], page_count: 3 },
        },
        raw_routines_page_1: { data: { routines: [] } },
      },
      last_updated: '2026-09-24T12:00:00.000Z',
    });

    const result = await syncHevyData(
      'user-1',
      'user-1',
      false,
      'provider-1',
      null,
      null,
      'local'
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      fetchWarnings: ['Missing Hevy workouts page before raw_workouts_page_3'],
    });
  });
});
