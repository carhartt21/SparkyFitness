import Button from './ui/Button';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MealType } from '../types/mealTypes';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import { isDayString } from '@workspace/shared';
import DateTimePicker from 'react-native-ui-datepicker';
import FooterActionBar from './FooterActionBar';
import { formatDateLabel, getTodayDate } from '../utils/dateUtils';
import { useAppLocale } from '../localization/i18n';
import { createDuplicatePressGuard } from '../utils/duplicatePress';
import {
  useCalendarPresentation,
  getCalendarMonthNames,
  getCalendarWeekdayShortNames,
} from '../utils/calendarLocalization';
import {
  calendarDayValue,
  selectedCalendarDay,
} from '../utils/calendarSelection';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';

type BulkAction = 'move' | 'copy';

interface Props {
  action: BulkAction;
  sourceDate: string;
  mealTypes: MealType[];
  selectedCount: number;
  busy: boolean;
  onClose: () => void;
  onApply: (action: BulkAction, targetDate: string, mealTypeId: string) => void;
}

export default function DiaryBulkActionSheet({
  action,
  sourceDate,
  mealTypes,
  selectedCount,
  busy,
  onClose,
  onApply,
}: Props) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { presentation } = useCalendarPresentation();
  const { fontScale } = useWindowDimensions();
  const [textPrimary, accentPrimary, accentText] = useCSSVariable([
    '--color-text-primary',
    '--color-accent-primary',
    '--color-accent-text',
  ]) as [string, string, string];
  const allowPress = useRef(createDuplicatePressGuard());
  const [targetDate, setTargetDate] = useState(sourceDate);
  const initialDay = calendarDayValue(
    isDayString(sourceDate) ? sourceDate : getTodayDate()
  );
  const [visibleMonth, setVisibleMonth] = useState(initialDay.getMonth());
  const monthNames = getCalendarMonthNames(locale);
  const weekdayNames = getCalendarWeekdayShortNames(locale);
  const [targetMealTypeId, setTargetMealTypeId] = useState<string | null>(null);
  const dateIsValid = isDayString(targetDate);
  const targetIsValid = mealTypes.some(
    (meal) => meal.id === targetMealTypeId && meal.is_visible
  );
  const canApply = !busy && selectedCount > 0 && dateIsValid && targetIsValid;
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={() => !busy && onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View className="max-h-[80%] rounded-t-3xl bg-background pt-5">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          >
            <View className="mb-3 gap-2">
              <Text className="text-xl font-bold text-text-primary">
                {action === 'copy'
                  ? t('diary.bulk.copyTitle', {
                      defaultValue: 'Copy selected foods',
                    })
                  : t('diary.bulk.moveTitle', {
                      defaultValue: 'Move selected foods',
                    })}
              </Text>
              <Pressable
                onPress={onClose}
                disabled={busy}
                accessibilityRole="button"
                className="min-h-11 min-w-11 self-end items-center justify-center px-2"
              >
                <Text className="text-accent-primary text-base">
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </Pressable>
            </View>
            <Text className="text-sm text-text-secondary mb-4">
              {t('diary.bulk.selectedCount', {
                defaultValue: '{{count}} selected foods',
                count: selectedCount,
              })}
            </Text>
            <Text className="text-sm font-medium text-text-primary mb-1">
              {t('diary.bulk.destinationDay', {
                defaultValue: 'Destination date',
              })}
            </Text>
            <View accessible={false}>
              <Text
                accessible
                accessibilityLabel={t('diary.bulk.chooseDate', {
                  defaultValue: 'Choose destination date',
                })}
                accessibilityValue={{
                  text: dateIsValid
                    ? formatDateLabel(targetDate, t, locale)
                    : '',
                }}
                className="mb-2 text-text-primary"
              >
                {dateIsValid
                  ? formatDateLabel(targetDate, t, locale)
                  : t('diary.bulk.chooseDate', {
                      defaultValue: 'Choose destination date',
                    })}
              </Text>
              <DateTimePicker
                mode="single"
                date={calendarDayValue(
                  dateIsValid ? targetDate : getTodayDate()
                )}
                locale={presentation.locale}
                onMonthChange={setVisibleMonth}
                components={{
                  IconPrev: (
                    <Icon name="chevron-back" size={18} color={textPrimary} />
                  ),
                  IconNext: (
                    <Icon
                      name="chevron-forward"
                      size={18}
                      color={textPrimary}
                    />
                  ),
                  MonthSelector: ({ onPress }) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('cycleCalendar.selectMonth', {
                        defaultValue: 'Select month',
                      })}
                      onPress={onPress}
                      className="min-h-11 justify-center px-2"
                    >
                      <Text style={{ color: textPrimary }}>
                        {monthNames[visibleMonth]}
                      </Text>
                    </Pressable>
                  ),
                  Month: (month) => (
                    <Text style={{ color: textPrimary }}>
                      {monthNames[month.index]}
                    </Text>
                  ),
                  Weekday: (weekday) => (
                    <Text style={{ color: textPrimary, fontSize: 12 }}>
                      {weekdayNames[weekday.index]}
                    </Text>
                  ),
                }}
                firstDayOfWeek={presentation.firstDayOfWeek}
                weekdaysHeight={Math.max(
                  25,
                  Math.ceil(12 * fontScale * 1.4 + 8)
                )}
                containerHeight={Math.max(
                  300,
                  6 * Math.max(44, Math.ceil(16 * fontScale * 1.3 + 12)) +
                    Math.ceil(12 * fontScale * 1.4 + 8)
                )}
                onChange={({ date }) => {
                  const day = selectedCalendarDay(date);
                  if (!busy && day) setTargetDate(day);
                }}
                styles={{
                  selected: { backgroundColor: accentPrimary },
                  selected_label: { color: accentText },
                  day_label: { color: textPrimary },
                  month_selector_label: { color: textPrimary },
                  year_selector_label: { color: textPrimary },
                  weekday_label: { color: textPrimary },
                }}
              />
            </View>
            {!dateIsValid && (
              <Text className="text-text-danger mb-2">
                {t('diary.bulk.invalidDate', {
                  defaultValue: 'Enter a valid date.',
                })}
              </Text>
            )}
            <Text className="text-sm font-medium text-text-primary mb-2">
              {t('diary.bulk.targetMeal', { defaultValue: 'Destination meal' })}
            </Text>
            <View className="gap-2">
              {mealTypes
                .filter((meal) => meal.is_visible)
                .map((meal) => (
                  <Button
                    variant={
                      targetMealTypeId === meal.id ? 'primary' : 'secondary'
                    }
                    key={meal.id}
                    disabled={busy}
                    onPress={() => setTargetMealTypeId(meal.id)}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: targetMealTypeId === meal.id,
                    }}
                    className={`min-h-11   px-4 py-3 ${targetMealTypeId === meal.id ? ' ' : ' '}`}
                  >
                    <Text className="text-text-primary">
                      {getMealTypeDisplayLabel(meal, t)}
                    </Text>
                  </Button>
                ))}
            </View>
          </ScrollView>
          <FooterActionBar>
            <Button
              variant="primary"
              disabled={!canApply}
              onPress={() => {
                if (
                  canApply &&
                  targetMealTypeId &&
                  allowPress.current('apply')
                ) {
                  onApply(action, targetDate, targetMealTypeId);
                }
              }}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center mt-4 disabled:opacity-50"
            >
              <Text className="font-semibold text-text-primary">
                {busy
                  ? t('common.saving', { defaultValue: 'Saving…' })
                  : t('diary.bulk.apply', { defaultValue: 'Apply' })}
              </Text>
            </Button>
          </FooterActionBar>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
