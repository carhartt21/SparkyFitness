import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeImage from './SafeImage';
import { getAuthHeaders } from '../services/api/authService';
import { normalizeUrl } from '../services/api/apiClient';
import {
  getActiveServerConfig,
  proxyHeadersToRecord,
  type ServerConfig,
} from '../services/storage';

export interface CapturePhotoRef {
  localUri?: string;
  remotePath?: string;
  consumedAt?: string;
}

export default function NutritionCaptureThumbnail({
  photo,
}: {
  photo: CapturePhotoRef;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    if (!photo.remotePath || photo.localUri) return;
    let active = true;
    void getActiveServerConfig()
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [photo.localUri, photo.remotePath]);
  const source = photo.localUri
    ? { uri: photo.localUri, headers: {} }
    : photo.remotePath && config
      ? {
          uri: `${normalizeUrl(config.url)}${photo.remotePath}`,
          headers: {
            ...proxyHeadersToRecord(config.proxyHeaders),
            ...getAuthHeaders(config),
          },
        }
      : null;
  if (!source) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nutritionPhotos.viewPhoto', {
          defaultValue: 'View meal photo',
        })}
        onPress={() => setFullScreen(true)}
        style={{ marginRight: 8 }}
      >
        <SafeImage
          source={source}
          style={{ width: 56, height: 56, borderRadius: 8 }}
        />
      </Pressable>
      <Modal
        visible={fullScreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreen(false)}
      >
        <View className="flex-1 bg-black justify-center">
          <SafeImage
            source={source}
            style={{ width: '100%', height: '85%' }}
            contentFit="contain"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setFullScreen(false)}
            className="self-center p-4"
          >
            <Text className="text-white">
              {t('common.close', { defaultValue: 'Close' })}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
