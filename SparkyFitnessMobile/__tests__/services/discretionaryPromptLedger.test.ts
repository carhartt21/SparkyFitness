import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetDiscretionaryPromptLedgerForTests,
  getSpentDiscretionaryPromptCounts,
  getTodayDiscretionaryPromptBudget,
  releaseFutureDiscretionaryPrompt,
  reserveDiscretionaryPrompt,
} from '../../src/services/discretionaryPromptLedger';

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const other = { serverConfigId: 'server-A', userId: 'user-B' };
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).getTime();

beforeEach(async () => {
  __resetDiscretionaryPromptLedgerForTests();
  await AsyncStorage.clear();
});

it('caps all scheduled attempts in a local day and keeps replay idempotent', async () => {
  const now = at(23, 9);
  for (const hour of [10, 11, 12]) {
    expect(
      await reserveDiscretionaryPrompt({
        identity,
        candidateId: `hydration:${hour}`,
        at: at(23, hour),
        now,
      })
    ).toBe(true);
  }
  expect(
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: 'hydration:10',
      at: at(23, 10),
      now,
    })
  ).toBe(true);
  expect(
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: 'nutrition:lunch',
      at: at(23, 13),
      now,
    })
  ).toBe(false);
  expect(
    await getSpentDiscretionaryPromptCounts(identity, at(23, 11, 30))
  ).toEqual({ '2026-09-23': 2 });
  expect(
    await getTodayDiscretionaryPromptBudget(identity, at(23, 11, 30))
  ).toEqual({ used: 3, remaining: 0 });
});

it('releases a confirmed future cancellation, but never refunds a near-due or past slot', async () => {
  const now = at(23, 9);
  for (const hour of [10, 11, 12]) {
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: `water:${hour}`,
      at: at(23, hour),
      now,
    });
  }
  await releaseFutureDiscretionaryPrompt({
    identity,
    candidateId: 'water:11',
    at: at(23, 11),
    now,
  });
  expect(await getTodayDiscretionaryPromptBudget(identity, now)).toEqual({
    used: 2,
    remaining: 1,
  });
  expect(
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: 'water:13',
      at: at(23, 13),
      now,
    })
  ).toBe(true);
  await releaseFutureDiscretionaryPrompt({
    identity,
    candidateId: 'water:10',
    at: at(23, 10),
    now: at(23, 9, 59),
  });
  expect(
    await getSpentDiscretionaryPromptCounts(identity, at(23, 10, 1))
  ).toEqual({ '2026-09-23': 1 });
  expect(
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: 'water:14',
      at: at(23, 14),
      now: at(23, 10, 1),
    })
  ).toBe(false);
});

it('keeps accounts separate while counting anonymous water against the active device day', async () => {
  const now = at(23, 9);
  await reserveDiscretionaryPrompt({
    identity: null,
    candidateId: 'anonymous-water',
    at: at(23, 10),
    now,
  });
  await reserveDiscretionaryPrompt({
    identity,
    candidateId: 'meal',
    at: at(23, 11),
    now,
  });
  await reserveDiscretionaryPrompt({
    identity: other,
    candidateId: 'move',
    at: at(23, 12),
    now,
  });
  expect(await getSpentDiscretionaryPromptCounts(identity, at(23, 13))).toEqual(
    { '2026-09-23': 2 }
  );
  expect(await getSpentDiscretionaryPromptCounts(other, at(23, 13))).toEqual({
    '2026-09-23': 2,
  });
});

it('fails closed if its storage cannot be read or written', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error('storage unavailable')
  );
  await expect(
    reserveDiscretionaryPrompt({
      identity,
      candidateId: 'meal',
      at: at(23, 12),
      now: at(23, 9),
    })
  ).rejects.toThrow('storage unavailable');
  await AsyncStorage.setItem(
    '@SparkyFitness/discretionaryPromptLedger:v1',
    '{broken'
  );
  await expect(
    reserveDiscretionaryPrompt({
      identity,
      candidateId: 'meal',
      at: at(23, 12),
      now: at(23, 9),
    })
  ).rejects.toThrow();
});

it('retains granted future reservations beyond the usual planning horizon', async () => {
  const now = at(23, 9);
  const distant = new Date(2026, 10, 23, 10).getTime();
  for (const candidateId of ['first', 'second', 'third']) {
    expect(
      await reserveDiscretionaryPrompt({
        identity,
        candidateId,
        at: distant,
        now,
      })
    ).toBe(true);
  }
  expect(
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: 'fourth',
      at: distant + 60_000,
      now,
    })
  ).toBe(false);
});
