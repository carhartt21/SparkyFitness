import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { PendingFoodAction } from '../services/nutritionActionOutbox';

interface Props {
  actions: PendingFoodAction[];
  storageError?: boolean;
}

export default function PendingNutritionActions({
  actions,
  storageError = false,
}: Props) {
  const { t } = useTranslation();
  if (actions.length === 0 && !storageError) return null;

  return (
    <View
      className="bg-surface rounded-xl p-4 mb-3 gap-3"
      accessibilityRole="summary"
    >
      <Text className="text-base font-bold text-text-primary">
        {t('nutritionOutbox.title', { defaultValue: 'Saved on this device' })}
      </Text>
      {storageError && (
        <Text className="text-sm text-text-danger">
          {t('nutritionOutbox.storageError', {
            defaultValue:
              'Some saved entries could not be read. They were kept for recovery.',
          })}
        </Text>
      )}
      {actions.map((action) => {
        const name =
          action.payload.food_name ||
          t('foodRow.unknownFood', { defaultValue: 'Unknown food' });
        const status =
          action.syncState === 'attentionRequired'
            ? t('nutritionOutbox.attention', {
                defaultValue: 'Needs attention',
              })
            : action.syncState === 'synced'
              ? t('nutritionOutbox.loadingDiary', {
                  defaultValue: 'Synced; loading diary',
                })
              : t('nutritionOutbox.pending', {
                  defaultValue: 'Waiting to sync',
                });
        const hasKnownEnergy =
          action.payload.calories !== undefined &&
          action.payload.serving_size !== undefined &&
          action.payload.serving_size > 0;
        const energy = hasKnownEnergy
          ? Math.round(
              (action.payload.calories! * action.payload.quantity) /
                action.payload.serving_size!
            )
          : null;
        return (
          <View
            key={action.clientOperationId}
            className="flex-row justify-between gap-3"
            accessibilityLabel={`${name}, ${status}`}
          >
            <View className="flex-1">
              <Text className="text-text-primary" numberOfLines={1}>
                {name}
              </Text>
              <Text className="text-xs text-text-muted">{status}</Text>
            </View>
            <Text className="text-sm text-text-secondary">
              {energy === null
                ? t('nutritionOutbox.unknownNutrition', {
                    defaultValue: 'Nutrition unknown',
                  })
                : t('nutritionOutbox.calories', {
                    defaultValue: '{{value}} Cal',
                    value: energy,
                  })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
