import {
  countOutbox,
  summarizeSyncActivity,
  SYNCED_VISIBLE_MS,
  type HealthSyncActivity,
} from '../../src/services/syncActivity';

const idle: HealthSyncActivity = { status: 'idle', at: 0 };
const none = { pending: 0, syncing: 0, attention: 0 };

describe('summarizeSyncActivity', () => {
  it('hides when nothing is running or outstanding', () => {
    expect(
      summarizeSyncActivity({
        health: idle,
        outbox: none,
        online: true,
        now: 1,
      })
    ).toBe('hidden');
  });

  it('shows a brief checkmark only after the Health job finishes', () => {
    const health: HealthSyncActivity = { status: 'synced', at: 1000 };
    expect(
      summarizeSyncActivity({ health, outbox: none, online: true, now: 2000 })
    ).toBe('synced');
    expect(
      summarizeSyncActivity({
        health,
        outbox: none,
        online: true,
        now: 1000 + SYNCED_VISIBLE_MS + 1,
      })
    ).toBe('hidden');
  });

  it('never claims success while local saves are still unsent', () => {
    const health: HealthSyncActivity = { status: 'synced', at: 1000 };
    const outbox = { pending: 2, syncing: 0, attention: 0 };
    expect(
      summarizeSyncActivity({ health, outbox, online: true, now: 1500 })
    ).toBe('savedLocally');
    expect(
      summarizeSyncActivity({ health, outbox, online: false, now: 1500 })
    ).toBe('waiting');
  });

  it('puts attention first, then running work', () => {
    expect(
      summarizeSyncActivity({
        health: { status: 'syncing', at: 1 },
        outbox: { pending: 0, syncing: 0, attention: 1 },
        online: true,
        now: 2,
      })
    ).toBe('attention');
    expect(
      summarizeSyncActivity({
        health: { status: 'syncing', at: 1 },
        outbox: none,
        online: true,
        now: 2,
      })
    ).toBe('syncing');
  });
});

describe('countOutbox', () => {
  it('counts each state separately and ignores synced actions', () => {
    expect(
      countOutbox([
        { syncState: 'pending' },
        { syncState: 'syncing' },
        { syncState: 'attentionRequired' },
        { syncState: 'synced' },
      ])
    ).toEqual({ pending: 1, syncing: 1, attention: 1 });
  });
});
