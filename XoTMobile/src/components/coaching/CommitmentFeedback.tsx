import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CoachingFeedback } from '@workspace/shared';
import { useCoachingCopy } from '../../hooks/useCoachingCopy';
import FormInput from '../FormInput';
import BottomSheetPicker from '../BottomSheetPicker';
import NeonButton from '../ui/NeonButton';
export function CommitmentFeedback({
  value,
  onChange,
}: {
  value: CoachingFeedback;
  onChange: (value: CoachingFeedback) => void;
}) {
  const { t } = useTranslation(),
    copy = useCoachingCopy(),
    [open, setOpen] = useState(false);
  return (
    <View className="gap-3">
      <NeonButton
        variant="subtle"
        label={t('coaching.feedback', { defaultValue: 'Optional feedback' })}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <FormInput
            accessibilityLabel={t('coaching.reason', {
              defaultValue: 'Your feedback (optional)',
            })}
            maxLength={1000}
            value={value.reason ?? ''}
            onChangeText={(reason) => onChange({ ...value, reason })}
          />
          <BottomSheetPicker
            title={t('coaching.effortLabel', { defaultValue: 'Actual effort' })}
            value={value.effort ?? ''}
            options={['low', 'medium', 'high'].map((option) => ({
              value: option,
              label: copy(`coaching.options.${option}`, option),
            }))}
            onSelect={(effort) =>
              onChange({
                ...value,
                effort: effort as CoachingFeedback['effort'],
              })
            }
          />
          <BottomSheetPicker
            title={t('coaching.feasibility', {
              defaultValue: 'How manageable was this?',
            })}
            value={value.feasibility ?? ''}
            options={['easy', 'manageable', 'difficult'].map((option) => ({
              value: option,
              label: copy(`coaching.options.${option}`, option),
            }))}
            onSelect={(feasibility) =>
              onChange({
                ...value,
                feasibility: feasibility as CoachingFeedback['feasibility'],
              })
            }
          />
        </>
      )}
    </View>
  );
}
