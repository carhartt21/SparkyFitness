import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { saveMealPhotoLocally } from '../services/nutritionPhotoCapture';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickMealPhoto'>;

/** Opens the camera on mount, including after a cold-launch deep link. */
export default function QuickMealPhotoScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const launched = useRef(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (launched.current) return;
    launched.current = true;
    setBusy(true);
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError(
          t('nutritionPhotoCapture.permission', {
            defaultValue: 'Allow camera access to capture a meal.',
          })
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
      });
      if (result.canceled) {
        navigation.goBack();
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('Missing camera image.');
      const capturedAt = new Date().toISOString();
      // iOS may hand back HEIC. Re-encode only when necessary so the durable
      // file and the upload MIME type match the server's supported formats.
      const supported = /\.(jpe?g|png|webp|gif)(?:\?|$)/i.test(asset.uri);
      const sourceUri = supported
        ? asset.uri
        : (
            await ImageManipulator.manipulateAsync(asset.uri, [], {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG,
            })
          ).uri;
      await saveMealPhotoLocally({ sourceUri, capturedAt });
      navigation.navigate('Tabs', { screen: 'Diary' });
    } catch {
      setError(
        t('nutritionPhotoCapture.saveFailed', {
          defaultValue: 'Meal photo could not be saved. Try again.',
        })
      );
    } finally {
      setBusy(false);
    }
  }, [navigation, t]);

  useEffect(() => {
    void capture();
  }, [capture]);

  return (
    <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
      <Text className="text-lg font-semibold text-text-primary">
        {busy
          ? t('nutritionPhotoCapture.saving', {
              defaultValue: 'Saving meal photo…',
            })
          : t('nutritionPhotoCapture.title', {
              defaultValue: 'Meal photo',
            })}
      </Text>
      {error && <Text className="text-center text-text-danger">{error}</Text>}
      {!busy && error && (
        <Button
          onPress={() => {
            launched.current = false;
            void capture();
          }}
        >
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      )}
      {!busy && (
        <Button variant="secondary" onPress={() => navigation.goBack()}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
      )}
    </View>
  );
}
