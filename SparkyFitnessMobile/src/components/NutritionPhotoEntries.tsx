import { useEffect, useMemo, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getActiveServerConfig,
  proxyHeadersToRecord,
  type ServerConfig,
} from '../services/storage';
import { getAuthHeaders } from '../services/api/authService';
import { normalizeUrl } from '../services/api/apiClient';
import type { NutritionCapture } from '../services/api/nutritionCaptureApi';
import type { PendingPhotoAction } from '../services/nutritionActionOutbox';
import SafeImage from './SafeImage';
import { formatDateToTimeLabel } from '../utils/entryTimeDisplay';

interface Props {
  local: PendingPhotoAction[];
  remote: NutritionCapture[];
}

interface PhotoRow {
  id: string;
  consumedAt: string;
  state: 'incomplete' | 'complete';
  localImage: string | null;
  remoteImage: string | null;
  syncState: PendingPhotoAction['syncState'] | null;
}

export default function NutritionPhotoEntries({ local, remote }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      void getActiveServerConfig()
        .then((value) => {
          if (active) setConfig(value);
        })
        .catch(() => undefined);
    };
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const rows = useMemo(() => {
    const localById = new Map(
      local.map((action) => [action.payload.id, action])
    );
    const merged: PhotoRow[] = remote.map((capture) => ({
      id: capture.id,
      consumedAt: capture.consumed_at,
      state: capture.completion_state,
      localImage: localById.get(capture.id)?.payload.images[0]?.uri ?? null,
      remoteImage: capture.images[0]?.url ?? null,
      syncState: localById.get(capture.id)?.syncState ?? null,
    }));
    const remoteIds = new Set(remote.map((capture) => capture.id));
    for (const action of local) {
      if (remoteIds.has(action.payload.id)) continue;
      merged.push({
        id: action.payload.id,
        consumedAt: action.payload.consumedAt,
        state: 'incomplete',
        localImage: action.payload.images[0]?.uri ?? null,
        remoteImage: null,
        syncState: action.syncState,
      });
    }
    return merged.sort((a, b) => a.consumedAt.localeCompare(b.consumedAt));
  }, [local, remote]);

  if (rows.length === 0) return null;
  const incomplete = rows.filter((row) => row.state === 'incomplete').length;
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 gap-3">
      <Text className="text-base font-bold text-text-primary">
        {t('nutritionPhotos.title', { defaultValue: 'Meal photos' })}
      </Text>
      <Text className="text-sm text-text-muted">
        {t('nutritionPhotos.incompleteCount', {
          count: incomplete,
          defaultValue: '{{count}} incomplete',
        })}
      </Text>
      {rows.map((row) => {
        const source = row.localImage
          ? { uri: row.localImage, headers: {} }
          : row.remoteImage && config
            ? {
                uri: `${normalizeUrl(config.url)}${row.remoteImage}`,
                headers: {
                  ...proxyHeadersToRecord(config.proxyHeaders),
                  ...getAuthHeaders(config),
                },
              }
            : null;
        return (
          <View key={row.id} className="flex-row gap-3 items-center">
            <SafeImage
              source={source}
              style={{ width: 64, height: 64, borderRadius: 8 }}
            />
            <View className="flex-1">
              <Text className="text-text-primary">
                {row.state === 'incomplete'
                  ? t('nutritionPhotos.incomplete', {
                      defaultValue: 'Incomplete meal',
                    })
                  : t('nutritionPhotos.complete', {
                      defaultValue: 'Completed meal',
                    })}
              </Text>
              <Text className="text-xs text-text-muted">
                {formatDateToTimeLabel(new Date(row.consumedAt))}
              </Text>
              {row.syncState === 'attentionRequired' && (
                <Text className="text-xs text-text-danger">
                  {t('nutritionOutbox.attention', {
                    defaultValue: 'Needs attention',
                  })}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
