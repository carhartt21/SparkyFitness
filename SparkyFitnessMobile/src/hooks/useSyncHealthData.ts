import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { syncHealthData as healthConnectSyncData } from '../services/healthConnectService';
import { markSyncInFlight } from '../services/autoSyncCoordinator';
import { saveLastSyncedTime } from '../services/storage';
import { addLog } from '../services/LogService';
import type { TimeRange } from '../services/storage';
import { serverConnectionQueryKey } from './queryKeys';
import { refreshHealthSyncCache } from './refreshHealthSyncCache';
import { useSyncActivityStore } from '../services/syncActivity';

interface SyncHealthDataParams {
  timeRange: TimeRange;
  healthMetricStates: Record<string, boolean>;
  /**
   * Re-send workout routes and sample series for sessions already collected
   * once, for this run only. Set by the user's explicit choice on the manual
   * sync; sync-on-open and background runs leave it off so they stay cheap.
   */
  forceTelemetry?: boolean;
}

export function useSyncHealthData(options?: {
  showToasts?: boolean;
  onSuccess?: (lastSyncedTime: string | null) => void;
  onError?: (error: Error) => void;
}) {
  const { showToasts = true, onSuccess, onError } = options ?? {};
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      timeRange,
      healthMetricStates,
      forceTelemetry = false,
    }: SyncHealthDataParams) => {
      const syncDone = markSyncInFlight();
      try {
        const result = await healthConnectSyncData(
          timeRange,
          healthMetricStates,
          forceTelemetry
        );
        if (result.success) {
          // Only read errors block the cursor; server-rejected records
          // (uploadErrors) are logged and reported but never re-synced.
          const hadSyncErrors = result.syncErrors.length > 0;
          const newSyncedTime = hadSyncErrors
            ? null
            : await saveLastSyncedTime();
          return {
            lastSyncedTime: newSyncedTime,
            syncErrors: result.syncErrors,
            uploadErrors: result.uploadErrors ?? [],
          };
        }
        throw new Error(
          result.error ||
            t('syncHealth.unknownError', { defaultValue: 'Unknown sync error' })
        );
      } finally {
        syncDone();
      }
    },
    // Routine progress and success show in the header's sync indicator
    // instead of toasts; incomplete and failed syncs still explain themselves.
    onMutate: () => {
      useSyncActivityStore.getState().setHealth({ status: 'syncing' });
    },
    onSuccess: (data) => {
      refreshHealthSyncCache(queryClient);
      queryClient.invalidateQueries({ queryKey: serverConnectionQueryKey });
      const incomplete =
        data.syncErrors.length > 0 || data.uploadErrors.length > 0;
      useSyncActivityStore.getState().setHealth({
        status: incomplete ? 'attention' : 'synced',
      });
      if (showToasts) {
        if (incomplete) {
          const details = [
            data.syncErrors.length > 0
              ? t('syncHealth.readErrors', {
                  defaultValue:
                    '{{count}} metrics could not be read. They will retry next sync.',
                  defaultValue_one:
                    '{{count}} metric could not be read. It will retry next sync.',
                  defaultValue_other:
                    '{{count}} metrics could not be read. They will retry next sync.',
                  count: data.syncErrors.length,
                })
              : null,
            data.uploadErrors.length > 0
              ? t('syncHealth.uploadErrors', {
                  defaultValue:
                    '{{count}} records were rejected by the server. See logs.',
                  defaultValue_one:
                    '{{count}} record was rejected by the server. See logs.',
                  defaultValue_other:
                    '{{count}} records were rejected by the server. See logs.',
                  count: data.uploadErrors.length,
                })
              : null,
          ]
            .filter(Boolean)
            .join(' ');
          Toast.show({
            type: 'info',
            text1: t('syncHealth.incomplete', {
              defaultValue: 'Sync incomplete',
            }),
            text2: details,
            visibilityTime: 4000,
          });
        }
      }
      if (data.lastSyncedTime !== null) {
        onSuccess?.(data.lastSyncedTime);
      }
    },
    onError: (error: Error) => {
      addLog(`Sync Error: ${error.message}`, 'ERROR');
      useSyncActivityStore
        .getState()
        .setHealth({ status: 'attention', message: error.message });
      if (showToasts) {
        Toast.show({
          type: 'error',
          text1: t('syncHealth.error', { defaultValue: 'Sync Error' }),
          text2: t('syncHealth.errorDetails', {
            defaultValue: 'The health data sync failed: {{message}}',
            message: error.message,
          }),
          visibilityTime: 4000,
        });
      }
      onError?.(error);
    },
  });
}
