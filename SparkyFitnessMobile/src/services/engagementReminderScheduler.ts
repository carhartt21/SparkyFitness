import * as Notifications from 'expo-notifications';
import type { ReminderCandidate } from './healthEngagementPolicy';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { hasNotificationPermission } from './notifications';
import { addLog } from './LogService';
import {
  releaseFutureDiscretionaryPrompt,
  reserveDiscretionaryPrompt,
} from './discretionaryPromptLedger';

let queue: Promise<void> = Promise.resolve();

function scopedIdentifier(
  prefix: string,
  identity: NutritionActionIdentity,
  candidate: ReminderCandidate
): string {
  return `${prefix}${encodeURIComponent(identity.serverConfigId)}:${encodeURIComponent(identity.userId)}:${candidate.id}`;
}

/** Reconcile only one feature-owned namespace; other reminders are untouched. */
export function reconcileScheduledEngagementReminders(input: {
  prefix: string;
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
  accepts: (candidate: ReminderCandidate) => boolean;
  contentFor: (candidate: ReminderCandidate) => {
    title: string;
    body: string;
    categoryIdentifier?: string;
  };
}): Promise<void> {
  const task = queue.then(async () => {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const owned = pending.filter((item) =>
      item.identifier.startsWith(input.prefix)
    );
    const permitted =
      input.enabled &&
      input.identity !== null &&
      (await hasNotificationPermission());
    const desired = new Map<string, ReminderCandidate>();
    if (permitted && input.identity) {
      for (const candidate of input.candidates) {
        if (input.accepts(candidate) && candidate.preferredAt > Date.now()) {
          desired.set(
            scopedIdentifier(input.prefix, input.identity, candidate),
            candidate
          );
        }
      }
    }
    const desiredIds = new Set(desired.keys());
    for (const item of owned) {
      const candidate = desired.get(item.identifier);
      if (
        !candidate ||
        item.content.data?.scheduledAt !== candidate.preferredAt
      ) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
        const data = item.content.data;
        if (
          typeof data?.serverConfigId === 'string' &&
          typeof data.userId === 'string' &&
          typeof data.candidateId === 'string' &&
          typeof data.scheduledAt === 'number'
        ) {
          await releaseFutureDiscretionaryPrompt({
            identity: {
              serverConfigId: data.serverConfigId,
              userId: data.userId,
            },
            candidateId: data.candidateId,
            at: data.scheduledAt,
          });
        }
      } else {
        // Migrate a pending request from a build without the ledger before
        // treating it as reconciled. If today's budget is full, cancel it.
        const reserved = await reserveDiscretionaryPrompt({
          identity: input.identity,
          candidateId: candidate.id,
          at: candidate.preferredAt,
        });
        if (reserved) {
          desired.delete(item.identifier);
        } else {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
          desired.delete(item.identifier);
        }
      }
    }
    const delivered = await Notifications.getPresentedNotificationsAsync();
    for (const item of delivered) {
      const identifier = item.request.identifier;
      if (identifier.startsWith(input.prefix) && !desiredIds.has(identifier)) {
        await Notifications.dismissNotificationAsync(identifier);
      }
    }
    if (!permitted || !input.identity) return;
    for (const [identifier, candidate] of desired) {
      if (
        !(await reserveDiscretionaryPrompt({
          identity: input.identity,
          candidateId: candidate.id,
          at: candidate.preferredAt,
        }))
      )
        continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          ...input.contentFor(candidate),
          data: {
            version: 1,
            serverConfigId: input.identity.serverConfigId,
            userId: input.identity.userId,
            candidateId: candidate.id,
            scheduledAt: candidate.preferredAt,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(candidate.preferredAt),
        },
      });
    }
  });
  queue = task.catch((error: unknown) => {
    addLog(
      `[EngagementReminders] Reconciliation failed: ${error instanceof Error ? error.name : 'unknown'}`,
      'ERROR'
    );
  });
  return task;
}
