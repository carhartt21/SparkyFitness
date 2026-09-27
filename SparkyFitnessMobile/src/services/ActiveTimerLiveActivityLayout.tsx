import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type ActiveTimerLiveActivityProps = {
  kind: 'fasting' | 'mobility';
  sessionId: string;
  title: string;
  subtitle: string;
  symbol: 'timer' | 'figure.flexibility';
  mode: 'elapsed' | 'countdown' | 'static';
  startedAt: number;
  endsAt: number;
  staticValue: string;
};

const ActiveTimerLiveActivity = (props: ActiveTimerLiveActivityProps) => {
  'widget';
  const icon = <Image systemName={props.symbol} />;
  const clock =
    props.mode === 'countdown' ? (
      <Text
        timerInterval={{
          lower: new Date(props.startedAt),
          upper: new Date(props.endsAt),
        }}
        countsDown
        modifiers={[
          monospacedDigit(),
          font({ weight: 'semibold' }),
          minimumScaleFactor(0.7),
          frame({ maxWidth: 96, alignment: 'trailing' }),
        ]}
      />
    ) : props.mode === 'elapsed' ? (
      <Text
        date={new Date(props.startedAt)}
        dateStyle="timer"
        modifiers={[
          monospacedDigit(),
          font({ weight: 'semibold' }),
          minimumScaleFactor(0.7),
          frame({ maxWidth: 96, alignment: 'trailing' }),
        ]}
      />
    ) : (
      <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>
        {props.staticValue}
      </Text>
    );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 })]}>
        {icon}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>
            {props.title}
          </Text>
          <Text modifiers={[lineLimit(1)]}>{props.subtitle}</Text>
        </VStack>
        <Spacer />
        {clock}
      </HStack>
    ),
    compactLeading: icon,
    compactTrailing: clock,
    minimal: icon,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 12 })]}>
        {icon}
        <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>
          {props.title}
        </Text>
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 12 })]}>{clock}</HStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 12, bottom: 10 })]}>
        <Text modifiers={[lineLimit(1)]}>{props.subtitle}</Text>
      </HStack>
    ),
  };
};

export default createLiveActivity<ActiveTimerLiveActivityProps>(
  'ActiveTimerLiveActivity',
  ActiveTimerLiveActivity
);
