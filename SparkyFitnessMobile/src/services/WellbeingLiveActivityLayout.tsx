import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type WellbeingLiveActivityProps = {
  sessionId: string;
  startedAt: number;
  endsAt: number;
  title: string;
  subtitle: string;
  finishLabel: string;
};

const WellbeingLiveActivity = (props: WellbeingLiveActivityProps) => {
  'widget';
  const timer = (
    <Text
      timerInterval={{
        lower: new Date(props.startedAt),
        upper: new Date(props.endsAt),
      }}
      countsDown
      modifiers={[monospacedDigit(), font({ weight: 'semibold' })]}
    />
  );
  const icon = <Image systemName="figure.walk" />;
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 })]}>
        {icon}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ weight: 'semibold' })]}>{props.title}</Text>
          <Text>{props.subtitle}</Text>
        </VStack>
        <Spacer />
        {timer}
      </HStack>
    ),
    compactLeading: icon,
    compactTrailing: timer,
    minimal: icon,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 12 })]}>
        {icon}
        <Text modifiers={[font({ weight: 'semibold' })]}>{props.title}</Text>
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 12 })]}>{timer}</HStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 12, bottom: 10 })]}>
        <Text>{props.subtitle}</Text>
        <Spacer />
        <Button
          label={props.finishLabel}
          systemImage="xmark"
          target={`engagement-finish-break:${props.sessionId}`}
        />
      </HStack>
    ),
  };
};

export default createLiveActivity<WellbeingLiveActivityProps>(
  'WellbeingLiveActivity',
  WellbeingLiveActivity
);
