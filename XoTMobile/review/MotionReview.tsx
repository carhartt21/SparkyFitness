// Isolated synthetic presentation harness. Never mounted by the production entrypoint.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CalorieRingCard from '../src/components/CalorieRingCard';
import ProgressTrackX from '../src/components/brand/ProgressTrackX';
import DashboardSummaryCard, {
  DashboardSummaryRow,
} from '../src/components/ui/DashboardSummaryCard';
import HydrationGauge from '../src/components/HydrationGauge';
import MacroCard from '../src/components/MacroCard';
import NeonButton from '../src/components/ui/NeonButton';
import ActionTile from '../src/components/ui/ActionTile';
import { useMotionPreferences } from '../src/hooks/useMotionPreferences';
import { useCSSVariable } from 'uniwind';

const Stack = createNativeStackNavigator<{ Widgets: undefined }>();
const phases = [43, 57, 100, 43, null, 100] as const;
function Gallery() {
  const [phase, setPhase] = useState(0);
  const [water, setWater] = useState(500);
  const [macro, setMacro] = useState(30);
  const { reducedMotion } = useMotionPreferences();
  const background = useCSSVariable('--color-background-primary') as string;
  const [accent, protein] = useCSSVariable([
    '--color-accent-primary',
    '--color-macro-protein',
  ]) as string[];
  const progress = phases[phase];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        testID="motion-review-scroll"
        contentContainerStyle={{ padding: 16, gap: 8 }}
      >
        <Text
          testID="motion-review-preference"
          className="text-sm text-text-secondary"
        >
          {reducedMotion ? 'Bewegung reduziert' : 'Bewegung aktiv'}
        </Text>
        <CalorieRingCard
          caloriesConsumed={phase ? 900 : 600}
          caloriesBurned={0}
          burnedIncludesBmr={false}
          calorieGoal={2000}
          remainingCalories={phase ? 1100 : 1400}
          progressPercent={phase ? 0.45 : 0.3}
        />
        <DashboardSummaryCard
          title="Täglicher Fortschritt"
          headingIcon="target"
          testID="motion-review-progress"
          renderVisual={({ size, light }) => (
            <ProgressTrackX
              progress={progress}
              label="Täglicher Fortschritt"
              unknownLabel="Nicht verfügbar"
              size={size}
              light={light}
              fit="track"
            />
          )}
        >
          <DashboardSummaryRow
            icon="book"
            color={accent}
            last
            changeKey={progress === 100 ? 'done' : 'pending'}
            accessibilityLabel="Lesen"
          >
            <Text className="text-sm text-text-primary">Lesen</Text>
            <Text className="text-xs text-text-secondary">
              {progress === 100 ? 'Abgeschlossen' : 'Noch offen'}
            </Text>
          </DashboardSummaryRow>
        </DashboardSummaryCard>
        <View className="flex-row gap-2">
          <NeonButton
            testID="motion-review-change"
            label="Ändern"
            onPress={() => setPhase((current) => (current + 1) % phases.length)}
          />
          <ActionTile
            icon="book"
            color={accent}
            label="Lesen"
            onPress={() => setMacro((current) => (current === 70 ? 30 : 70))}
          />
        </View>
        <MacroCard
          label="Protein"
          consumed={macro}
          goal={100}
          color={protein}
          overfillColor={protein}
          row
        />
        <HydrationGauge
          consumed={water}
          goal={2500}
          containerVolume={500}
          onIncrement={() => setWater((current) => current + 500)}
          onDecrement={() => setWater((current) => Math.max(0, current - 500))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
export default function MotionReview() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Widgets" component={Gallery} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
