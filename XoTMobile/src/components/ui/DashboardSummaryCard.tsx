import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { progressionXGeometry } from '@workspace/shared';
import GlowCard from './GlowCard';
import IconBadge from './IconBadge';
import { useGlowTheme } from './glow';
import Icon, { type IconName } from '../Icon';

interface SummaryVisualLayout {
  size: number;
  stacked: boolean;
  light: boolean;
  trackColor: string;
}

/** The energy and task summaries share their frame, columns and reading order. */
export default function DashboardSummaryCard({
  title,
  headingIcon,
  testID,
  accessibilityLabel,
  onOpen,
  onCardPress,
  openTestID,
  renderVisual,
  children,
  footer,
}: {
  title: string;
  headingIcon: IconName;
  testID: string;
  accessibilityLabel?: string;
  onOpen?: () => void;
  /** Optional whole-card target; nested header/row controls retain their actions. */
  onCardPress?: () => void;
  openTestID?: string;
  renderVisual?: (layout: SummaryVisualLayout) => ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [cardGlow, muted] = useCSSVariable([
    '--color-card-glow',
    '--color-text-muted',
  ]) as string[];
  const light = !useGlowTheme();
  const available = contentWidth ?? width - 64;
  const stacked = fontScale > 1.3 || available < 280;
  const size = Math.min(
    120,
    Math.max(104, Math.round((available - 12) * 0.36))
  );
  const heading = (
    <>
      <View style={{ width: 18 }} />
      <View className="flex-1 flex-row items-center justify-center gap-2">
        <Icon name={headingIcon} size={18} color={muted} />
        <Text
          accessibilityRole="header"
          className="shrink text-center text-base font-semibold text-text-primary"
          maxFontSizeMultiplier={1.8}
        >
          {title}
        </Text>
      </View>
      {onOpen ? (
        <Icon name="chevron-forward" size={18} color={muted} />
      ) : (
        <View style={{ width: 18 }} />
      )}
    </>
  );
  const card = (
    <GlowCard
      testID={testID}
      glowColor={cardGlow}
      accessibilityLabel={onOpen ? undefined : accessibilityLabel}
      className="mb-2 px-3 py-2"
    >
      {onOpen ? (
        <Pressable
          testID={openTestID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onOpen}
          className="min-h-11 flex-row items-center gap-3 active:opacity-70"
        >
          {heading}
        </Pressable>
      ) : (
        <View className="min-h-11 flex-row items-center gap-3">{heading}</View>
      )}
      <View
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: 12,
          alignItems: stacked ? 'center' : 'flex-start',
        }}
      >
        {renderVisual ? (
          <View
            testID={`${testID}-visual`}
            className="items-center justify-center"
            style={
              stacked ? { width: size } : { width: size, alignSelf: 'stretch' }
            }
          >
            {renderVisual({
              size,
              stacked,
              light,
              trackColor: light
                ? progressionXGeometry.baselineLight
                : progressionXGeometry.baselineDark,
            })}
          </View>
        ) : null}
        <View
          testID={`${testID}-rows`}
          style={
            stacked || !renderVisual
              ? { width: '100%' }
              : { width: available - size - 12, minWidth: 0 }
          }
        >
          {children}
        </View>
      </View>
      {footer}
    </GlowCard>
  );
  return onCardPress ? (
    <Pressable
      testID={`${testID}-tap-target`}
      onPress={onCardPress}
      accessible={false}
      className="active:opacity-80"
    >
      {card}
    </Pressable>
  ) : (
    card
  );
}

/** Matching icon holders, 44-point or larger row targets and separators for both cards. */
export function DashboardSummaryRow({
  icon,
  color,
  children,
  onPress,
  accessibilityLabel,
  testID,
  last = false,
}: {
  icon: IconName;
  color: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  last?: boolean;
}) {
  const chevron = useCSSVariable('--color-text-muted') as string;
  const content = (
    <>
      <IconBadge icon={icon} color={color} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {onPress ? (
        <Icon name="chevron-forward" size={14} color={chevron} />
      ) : null}
    </>
  );
  const className = `min-h-11 flex-row items-center gap-2 py-1 ${last ? '' : 'border-b border-border-subtle'}`;
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`${className} active:opacity-70`}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={testID} className={className}>
      {content}
    </View>
  );
}
