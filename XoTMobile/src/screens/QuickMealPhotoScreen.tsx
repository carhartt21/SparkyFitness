import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { saveMealPhotoLocally } from '../services/nutritionPhotoCapture';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickMealPhoto'>;

/** Opens the camera on mount, including after a cold-launch deep link. */
export default function QuickMealPhotoScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const launched = useRef(false);
  const [phase, setPhase] = useState<'opening' | 'saving' | 'idle'>('opening');
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (launched.current) return;
    launched.current = true;
    setPhase('opening');
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
      setPhase('saving');
      await saveMealPhotoLocally({ sourceUri, capturedAt });
      navigation.navigate('Tabs', { screen: 'Diary' });
    } catch (cause) {
      const diagnostic =
        Constants.expoConfig?.extra?.devTestHttpOrigin && cause instanceof Error
          ? ` (${cause.message})`
          : '';
      setError(
        t('nutritionPhotoCapture.saveFailed', {
          defaultValue: 'Meal photo could not be saved. Try again.',
        }) + diagnostic
      );
    } finally {
      setPhase('idle');
    }
  }, [navigation, t]);

  useEffect(() => {
    if (!isFocused) return;
    // This screen is itself a native-stack modal. Presenting the system camera
    // during its opening transition can leave a later camera request hanging
    // behind the old presentation. Wait until that transition is finished.
    // A cold-launch route may have no transition event, hence the fallback.
    launched.current = false;
    const stop = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) void capture();
    });
    const fallback = setTimeout(() => void capture(), 650);
    return () => {
      stop();
      clearTimeout(fallback);
    };
  }, [capture, isFocused, navigation]);

  const busy = phase !== 'idle';

  return (
    <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
      <Text className="text-lg font-semibold text-text-primary">
        {busy
          ? phase === 'opening'
            ? t('nutritionPhotoCapture.opening', {
                defaultValue: 'Opening camera…',
              })
            : t('nutritionPhotoCapture.saving', {
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
