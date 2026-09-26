import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { markCurrentVersionSeen } from '../src/services/whatsNewBanner';
import { saveServerConfig } from '../src/services/storage';
import { useAppPreferencesStore } from '../src/stores/appPreferencesStore';
import { useDiaryDateStore } from '../src/stores/diaryDateStore';
import { setThemePreference } from '../src/services/themeService';
import { reviewDate, reviewResponse } from './fixtures';

const transport = global.fetch;
export default function ReviewApp() {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    async function prepare() {
      if (!__DEV__ || Device.isDevice)
        throw new Error('UI review requires a development simulator');
      const config = (await (
        await transport('http://127.0.0.1:43991/scenario')
      ).json()) as {
        language: 'en' | 'de';
        theme: 'Dark' | 'Light' | 'Amoled';
        scenario: string;
      };
      global.fetch = async (input, options) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        );
        if (url.origin !== 'https://ui-review.invalid')
          throw new Error(`Review blocked network origin: ${url.origin}`);
        const method = options?.method ?? 'GET';
        if (method !== 'GET')
          throw new Error(`Review is read-only: ${method} ${url.pathname}`);
        try {
          if (
            config.scenario === 'error' &&
            url.pathname === '/api/daily-summary'
          )
            return new Response('{}', { status: 503 });
          return new Response(
            JSON.stringify(reviewResponse(url.pathname, config.scenario)),
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.warn(String(error));
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 501,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      };
      await markCurrentVersionSeen();
      await useAppPreferencesStore.persist.rehydrate();
      useAppPreferencesStore.setState({
        languagePreference: config.language,
        liquidGlassTabBarEnabled: false,
        hiddenHealthTrends: ['steps', 'weight', 'sleep', 'hydration'],
        notificationsEnabled: false,
        fastingEnabled: false,
        caffeineCardVisible: false,
        cycleCardVisible: false,
        medicationsCardVisible: false,
        progressPhotosCardVisible: false,
      });
      await AsyncStorage.multiSet([
        ['syncOnOpenEnabled', 'false'],
        ['backgroundSyncEnabled', 'false'],
      ]);
      await saveServerConfig({
        id: 'ui-review',
        url: 'https://ui-review.invalid',
        apiKey: 'synthetic-not-a-credential',
        authType: 'apiKey',
      });
      await setThemePreference(config.theme);
      useDiaryDateStore.getState().setSelectedDate(reviewDate);
      setReady(true);
    }
    void prepare().catch((error) => setFailure(String(error)));
  }, []);
  if (failure) return <Text accessibilityRole="alert">{failure}</Text>;
  return ready ? <App /> : null;
}
