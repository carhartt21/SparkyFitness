import { useEffect, useState } from 'react';
import { Keyboard, Text } from 'react-native';
import * as Device from 'expo-device';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { markCurrentVersionSeen } from '../src/services/whatsNewBanner';
import { saveServerConfig } from '../src/services/storage';
import { useAppPreferencesStore } from '../src/stores/appPreferencesStore';
import { useDiaryDateStore } from '../src/stores/diaryDateStore';
import { setThemePreference } from '../src/services/themeService';
import { saveDashboardSnapshot } from '../src/services/dashboardSnapshot';
import { rememberActiveNutritionUser } from '../src/services/nutritionIdentity';
import { buildDailySummary } from '../src/services/dailySummaryService';
import { reviewDate, summaryFixture } from './fixtures';
import { createNutritionFixture } from './nutritionFixture';
import { createWellnessReviewFixture } from './wellnessFixture';
import { trackingReviewResponse } from './trackingFixture';
import { getTodayDate } from '../src/utils/dateUtils';
import { dailyDetailPlanning, dailyDetailSessions } from './dailyDetailFixture';
import MotionReview from './MotionReview';
import { createCoachingReviewFixture } from './coachingFixture';
import { createMobilityReviewFixture } from './mobilityFixture';
import {
  saveMobilityRoutine,
  startMobilitySession,
  applyMobilitySessionAction,
} from '../src/services/mobilityRoutineStore';
import { saveHealthPreference } from '../src/services/healthkit/preferences';
import { initializeI18n } from '../src/localization/i18n';

const transport = global.fetch;
export default function ReviewApp() {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  const [motionReview, setMotionReview] = useState(false);
  useEffect(() => {
    let keyboardSubscription:
      ReturnType<typeof Keyboard.addListener> | undefined;
    async function prepare() {
      if (!__DEV__ || Device.isDevice)
        throw new Error('UI review requires a development simulator');
      // XCTest's keyboard frame bounds the keys, excluding the rounded panel
      // above them. Audit the OS-reported panel edge, not its key hit regions.
      keyboardSubscription = Keyboard.addListener(
        'keyboardDidShow',
        (event) => {
          void transport('http://127.0.0.1:43991/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'KEYBOARD',
              path: '/review/keyboard',
              metrics: event.endCoordinates,
            }),
          }).catch(() => undefined);
        }
      );
      const config = (await (
        await transport('http://127.0.0.1:43991/scenario')
      ).json()) as {
        language: 'en' | 'de';
        theme: 'Dark' | 'Light' | 'Amoled';
        scenario: string;
        nativeTabs?: boolean;
        v40Review?: boolean;
        v41Review?: boolean;
        v42Review?: boolean;
        v43Review?: boolean;
        v44Review?: boolean;
        v45Review?: boolean;
        motionReview?: boolean;
        mobilityReview?: boolean;
        coachingReview?: boolean;
      };
      const coachingFixture = createCoachingReviewFixture();
      const fixture = createNutritionFixture(
        config.scenario,
        config.v42Review,
        config.v44Review || config.v45Review
      );
      const mobilityFixture = createMobilityReviewFixture();
      const wellnessFixture = createWellnessReviewFixture(config.scenario);
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
        try {
          if (
            ['error', 'saved'].includes(config.scenario) &&
            url.pathname === '/api/daily-summary'
          )
            return new Response('{}', { status: 503 });
          if (options?.body !== undefined && typeof options.body !== 'string')
            throw new Error('Review only accepts JSON request bodies');
          const wellnessResult = wellnessFixture.respond(
            url,
            method,
            options?.body
          );
          if (
            config.v41Review &&
            method === 'GET' &&
            url.pathname === '/api/water-containers'
          )
            return new Response(
              JSON.stringify([
                {
                  id: 1,
                  name: 'Synthetic glass',
                  volume: 250,
                  unit: 'ml',
                  is_primary: true,
                  servings_per_container: 1,
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          const supplementResult =
            config.v40Review &&
            method === 'GET' &&
            ['/api/v2/medications', '/api/v2/medications/entries'].includes(
              url.pathname
            )
              ? trackingReviewResponse(
                  url.pathname,
                  'populated',
                  getTodayDate(),
                  undefined,
                  url.searchParams
                )
              : undefined;
          const mobilityResult =
            config.mobilityReview || config.v43Review
              ? mobilityFixture.respond(url, method, options?.body)
              : undefined;
          const coachingResult = config.coachingReview
            ? coachingFixture(url, method)
            : undefined;
          const result =
            config.v45Review &&
            method === 'GET' &&
            url.pathname === '/api/v2/activity-planning'
              ? dailyDetailPlanning(url, getTodayDate())
              : coachingResult !== undefined
                ? coachingResult
                : mobilityResult !== undefined
                  ? mobilityResult
                  : supplementResult !== undefined
                    ? supplementResult
                    : wellnessResult === undefined
                      ? fixture.respond(url, method, options?.body)
                      : wellnessResult;
          if (method !== 'GET' || url.pathname === '/api/daily-summary') {
            await transport('http://127.0.0.1:43991/event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method,
                path: url.pathname,
                entries: fixture.snapshot(),
                wellness: wellnessFixture.snapshot(),
              }),
            });
          }
          const body =
            config.v45Review &&
            method === 'GET' &&
            url.pathname === '/api/daily-summary' &&
            result &&
            typeof result === 'object'
              ? {
                  ...result,
                  exerciseSessions:
                    url.searchParams.get('date') === getTodayDate()
                      ? dailyDetailSessions(getTodayDate())
                      : [],
                }
              : result;
          return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.warn(String(error));
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 501,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      };
      // Every scenario starts with isolated synthetic cache data. Error captures
      // must not accidentally reuse the preceding over-target scenario.
      const cacheKeys = (await AsyncStorage.getAllKeys()).filter(
        (key) =>
          key.startsWith('@SparkyFitness/dashboard-cache/') ||
          key.startsWith('@SparkyFitness/mobility-routines/v1/ui-review/')
      );
      await AsyncStorage.multiRemove(cacheKeys);
      await markCurrentVersionSeen();
      await useAppPreferencesStore.persist.rehydrate();
      useAppPreferencesStore.setState({
        languagePreference: config.language,
        hiddenHealthTrends: ['steps', 'weight', 'sleep', 'hydration'],
        notificationsEnabled: config.scenario === 'notifications',
        fastingEnabled: false,
        caffeineCardVisible: config.scenario === 'hydration-review',
        cycleCardVisible: false,
        medicationsCardVisible: false,
        checkinCustomTagsByAccount: {},
        progressPhotosCardVisible: false,
        diarySummaryVisible: true,
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
      await rememberActiveNutritionUser('review-user');
      if (config.mobilityReview || config.v43Review) {
        const identity = { serverConfigId: 'ui-review', userId: 'review-user' };
        await saveHealthPreference('writebackWorkoutEnabled', false);
        const routine = await saveMobilityRoutine(identity, {
          name: 'Schulter- und Hüftmobilität',
          cue: 'off',
          steps: [
            {
              name: 'Schulterdehnung',
              instructions:
                'Sanft dehnen, nach der Hälfte bei Bedarf die Seite wechseln.',
              side: 'both',
              kind: 'timed',
              durationSeconds: 20,
              transitionSeconds: 5,
            },
            {
              name: 'Hüftbeuger',
              instructions: 'Bewegen Sie sich in einem angenehmen Bereich.',
              side: 'both',
              kind: 'timed',
              durationSeconds: 20,
              transitionSeconds: 5,
            },
          ],
        });
        mobilityFixture.allowRoutine(routine.id);
        // Pin the diary date so a review crossing midnight cannot move the
        // fixture's workout off the selected day. The paused timer resumes now.
        if (config.mobilityReview) {
          const startedAt = new Date(`${reviewDate}T10:00:00Z`);
          const session = await startMobilitySession(
            identity,
            routine.id,
            startedAt
          );
          await applyMobilitySessionAction(
            identity,
            session.id,
            'pause',
            startedAt
          );
        }
      }
      if (config.scenario === 'saved') {
        await saveDashboardSnapshot(
          { serverConfigId: 'ui-review', userId: 'review-user' },
          {
            version: 1,
            date: reviewDate,
            savedAt: Date.now() - 3600000,
            preferences: {
              energy_unit: 'kcal',
              water_display_unit: 'ml',
              time_format: 'HH:mm',
            },
            summary: buildDailySummary(reviewDate, {
              ...summaryFixture,
              exerciseEntries: summaryFixture.exerciseSessions,
              waterIntake: { water_ml: summaryFixture.waterIntake },
              stepCalories: 0,
            }),
          }
        );
      }
      await setThemePreference(config.theme);
      await initializeI18n(config.language);
      setMotionReview(config.motionReview === true);
      useDiaryDateStore
        .getState()
        .setSelectedDate(
          config.v44Review || config.v45Review ? getTodayDate() : reviewDate
        );
      setReady(true);
      if (config.motionReview) await SplashScreen.hideAsync();
    }
    void prepare().catch((error) => setFailure(String(error)));
    return () => keyboardSubscription?.remove();
  }, []);
  if (failure) return <Text accessibilityRole="alert">{failure}</Text>;
  return ready ? motionReview ? <MotionReview /> : <App /> : null;
}
