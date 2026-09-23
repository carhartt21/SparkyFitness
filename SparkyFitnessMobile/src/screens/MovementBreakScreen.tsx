import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/ui/Button';
import SegmentedControl from '../components/SegmentedControl';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  finishMovementBreak,
  startMovementBreak,
} from '../services/wellbeingLiveActivity';
import {
  getWellbeingSession,
  subscribeWellbeingSession,
  type WellbeingSession,
} from '../services/wellbeingSessionStore';
import type { RootStackScreenProps } from '../types/navigation';

type Props = RootStackScreenProps<'MovementBreak'>;
type Duration = '2' | '5' | '10';

export default function MovementBreakScreen(_props: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const [session, setSession] = useState<WellbeingSession | null>(null);
  const [duration, setDuration] = useState<Duration>('5');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    void getWellbeingSession()
      .then(setSession)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    refresh();
    const stop = subscribeWellbeingSession(refresh);
    const foreground = AppState.addEventListener('change', (value) => {
      if (value === 'active') {
        setNow(Date.now());
        refresh();
      }
    });
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      stop();
      foreground.remove();
      clearInterval(timer);
    };
  }, [refresh]);

  const active =
    session?.state === 'active' && Date.parse(session.endsAt) > now;
  const remaining = active
    ? Math.max(0, Math.ceil((Date.parse(session.endsAt) - now) / 1_000))
    : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  const header = useScreenHeader({
    title: t('engagement.breakTitle', { defaultValue: 'Movement break' }),
    left: { kind: 'back' },
  });

  const start = async () => {
    setBusy(true);
    setError(false);
    try {
      setSession(await startMovementBreak(Number(duration)));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    setError(false);
    try {
      await finishMovementBreak();
      refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="flex-1 bg-background px-4"
      style={nativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <View className="flex-1 justify-center gap-5">
        <Text className="text-2xl font-semibold text-text-primary text-center">
          {active
            ? `${minutes}:${seconds}`
            : t('engagement.breakReady', {
                defaultValue: 'Ready for a movement break?',
              })}
        </Text>
        <Text className="text-base text-text-secondary text-center">
          {t('engagement.breakExplanation', {
            defaultValue:
              'Stand, walk, or move in a way that works for you. Starting or finishing this timer does not log movement.',
          })}
        </Text>
        {error && (
          <Text className="text-icon-danger text-center">
            {t('engagement.breakError', {
              defaultValue: 'The break timer could not be updated.',
            })}
          </Text>
        )}
        {active ? (
          <Button disabled={busy} loading={busy} onPress={() => void finish()}>
            {t('engagement.finishBreak', { defaultValue: 'Finish timer' })}
          </Button>
        ) : (
          <>
            <SegmentedControl
              segments={[
                {
                  key: '2',
                  label: t('engagement.twoMinutes', { defaultValue: '2 min' }),
                },
                {
                  key: '5',
                  label: t('engagement.fiveMinutes', { defaultValue: '5 min' }),
                },
                {
                  key: '10',
                  label: t('engagement.tenMinutes', { defaultValue: '10 min' }),
                },
              ]}
              activeKey={duration}
              onSelect={setDuration}
            />
            <Button disabled={busy} loading={busy} onPress={() => void start()}>
              {t('engagement.startBreak', {
                defaultValue: 'Start break timer',
              })}
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
