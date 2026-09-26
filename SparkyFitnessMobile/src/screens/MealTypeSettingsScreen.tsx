import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  type AccessibilityActionEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { toHourMinute } from '@workspace/shared';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { mealTypesQueryKey } from '../hooks/queryKeys';
import {
  fetchMealTypes,
  createMealType,
  updateMealType,
  updateMealTypeOrder,
  deleteMealType,
} from '../services/api/mealTypesApi';
import { addLog } from '../services/LogService';
import Icon from '../components/Icon';
import Switch from '../components/ui/Switch';
import MealTypeFormSheet, {
  type MealTypeFormSheetRef,
} from '../components/MealTypeFormSheet';
import MealTypeTimePickerSheet, {
  type MealTypeTimePickerSheetRef,
} from '../components/MealTypeTimePickerSheet';
import { MEAL_CONFIG } from '../constants/meals';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import {
  computeReorderTargetIndex,
  createReorderRowPanGesture,
  REORDER_ROW_HEIGHT,
  resetReorderDragPreview,
  useReorderRowGeometry,
  useReorderRowPreviewStyle,
} from '../components/WorkoutReorderList';
import type { MealType } from '../types/mealTypes';
import type { RootStackScreenProps } from '../types/navigation';

type MealTypeSettingsScreenProps = RootStackScreenProps<'MealTypeSettings'>;

// The final settings mockup is a CONTINUOUS list of rows (border-b separators, no margin
// between them), so the drag geometry uses the real rendered stride: exactly the shared
// row height. WorkoutReorderList's own 8px item gap does not apply here.
const ROW_HEIGHT = REORDER_ROW_HEIGHT;

/**
 * Module-scope CUSTOM meal-type row (stable component identity; gesture-driven).
 * System rows are rendered by the module-scope SystemMealTypeRow below — both
 * share `useReorderRowPreviewStyle` so the WHOLE unified list opens a real live
 * gap preview during a drag (active row floats, every other row springs one
 * stride toward the origin as the finger crosses it). System rows therefore
 * PARTICIPATE in the transient preview as passive siblings, but stay
 * non-draggable and their persisted anchors are never rewritten — only custom
 * sort_order is ever persisted (see moveCustomType / doPersist).
 */
const CustomMealTypeRow: React.FC<{
  mt: MealType;
  index: number;
  totalRows: number;
  t: ReturnType<typeof useTranslation>['t'];
  onEdit: (mt: MealType) => void;
  onTime: (mt: MealType) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility: (mt: MealType, value: boolean) => void;
  textMuted: string;
  textSecondary: string;
  activeDragIndex: SharedValue<number>;
  panY: SharedValue<number>;
  committingTranslate: SharedValue<number>;
  targetIndex: SharedValue<number>;
  strides: number[];
}> = ({
  mt,
  index,
  totalRows,
  t,
  onEdit,
  onTime,
  onMove,
  onToggleVisibility,
  textMuted,
  textSecondary,
  activeDragIndex,
  panY,
  committingTranslate,
  targetIndex,
  strides,
}) => {
  const dragGesture = createReorderRowPanGesture({
    index,
    activeDragIndex,
    panY,
    committingTranslate,
    targetIndex,
    onMove,
  });

  const previewStyle = useReorderRowPreviewStyle(
    index,
    activeDragIndex,
    panY,
    committingTranslate,
    targetIndex,
    strides
  );

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      onMove(index, Math.min(index + 1, totalRows - 1));
    } else if (event.nativeEvent.actionName === 'decrement') {
      onMove(index, Math.max(index - 1, 0));
    }
  };

  return (
    <Animated.View
      key={mt.id}
      testID={`meal-type-${mt.user_id === null ? 'system' : 'custom'}-${mt.id}`}
      className="flex-row items-center bg-surface border-b border-border/40"
      style={[previewStyle, { height: ROW_HEIGHT }]}
    >
      <GestureDetector gesture={dragGesture}>
        <View
          testID={`drag-handle-${mt.id}`}
          className="px-4 py-3"
          accessibilityRole="adjustable"
          accessibilityLabel={t('mealTypeSettings.reorder', {
            defaultValue: 'Reorder {{name}}',
            name: getMealTypeDisplayLabel(mt, t),
          })}
          accessibilityActions={[
            {
              name: 'decrement',
              label: t('mealTypeSettings.moveUp', { defaultValue: 'Move up' }),
            },
            {
              name: 'increment',
              label: t('mealTypeSettings.moveDown', {
                defaultValue: 'Move down',
              }),
            },
          ]}
          onAccessibilityAction={handleAccessibilityAction}
        >
          <Icon name="reorder-handle" size={22} color={textMuted} />
        </View>
      </GestureDetector>
      <TouchableOpacity
        className="flex-1 py-3 flex-shrink flex-row items-center gap-2"
        onPress={() => onEdit(mt)}
        activeOpacity={0.6}
        accessibilityLabel={t('mealTypeSettings.edit', {
          defaultValue: 'Edit {{name}}',
          name: getMealTypeDisplayLabel(mt, t),
        })}
        testID={`edit-custom-${mt.id}`}
      >
        {mt.user_id === null ? (
          <Icon
            name={MEAL_CONFIG[mt.name.toLowerCase()]?.icon ?? 'meal-snack'}
            size={20}
            color={textSecondary}
          />
        ) : null}
        <Text
          className="text-base text-text-primary font-medium"
          numberOfLines={1}
        >
          {getMealTypeDisplayLabel(mt, t)}
        </Text>
      </TouchableOpacity>
      <MealTypeTimeCell
        mealType={mt}
        onPress={() => onTime(mt)}
        textSecondary={textSecondary}
        t={t}
      />
      <View className="pr-4 pl-1">
        <Switch
          value={mt.is_visible}
          onValueChange={(val) => onToggleVisibility(mt, val)}
          accessibilityLabel={t('mealTypeSettings.visible', {
            defaultValue: 'Visible {{name}}',
            name: getMealTypeDisplayLabel(mt, t),
          })}
        />
      </View>
    </Animated.View>
  );
};

const MealTypeSettingsScreen: React.FC<MealTypeSettingsScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const textMuted = useCSSVariable('--color-text-muted') as string;
  const textSecondary = useCSSVariable('--color-text-secondary') as string;

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [editingType, setEditingType] = useState<MealType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const formSheetRef = useRef<MealTypeFormSheetRef>(null);
  const timePickerRef = useRef<MealTypeTimePickerSheetRef>(null);

  const {
    data: mealTypes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: mealTypesQueryKey,
    queryFn: fetchMealTypes,
    staleTime: 0,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: mealTypesQueryKey });
  }, [queryClient]);

  /**
   * Per-field mutation ownership (CodeRabbit P1) + SERIALIZED network writes
   * with SYNCHRONOUS per-record slot reservation (CodeRabbit P1 5231725071).
   *
   * Three layers, deliberately distinct:
   *
   * 1. Optimistic ownership: every mutation gets a unique token allocated at
   *    the SYNCHRONOUS user-action boundary (before any await), and field
   *    ownership is recorded in `fieldOwnerRef: Map<'<id>:<field>', token>`
   *    at that same boundary. A mutation may roll back/merge a field ONLY
   *    while it still owns that field — a newer user action that took the
   *    field over is never touched by an older completion. The optimistic
   *    cache write after `cancelQueries` is ALSO ownership-guarded, so a
   *    delayed older onMutate cannot overwrite a newer optimistic value.
   *
   * 2. Network execution ordering: `updateRequestQueueRef` reserves a queue
   *    SLOT per record SYNCHRONOUSLY at the user-action boundary (before
   *    `cancelQueries`). The slot is a `done` promise; `mutationFn` waits for
   *    the predecessor slot, performs the PUT, and resolves its own slot in
   *    a `finally`. The newest user intent is therefore always the last
   *    server write regardless of cancellation/network timing. Different
   *    record IDs may still run concurrently.
   */
  interface UpdateReservation {
    predecessor: Promise<void>;
    done: Promise<void>;
    resolveDone: () => void;
  }

  interface GenericUpdateVars {
    id: string;
    data: Partial<Omit<MealType, 'id'>>;
    token: number;
    previousFields: Record<string, unknown>;
    optimisticFields: Record<string, unknown>;
    reservation: UpdateReservation;
  }

  const mutationTokenRef = useRef(0);
  const fieldOwnerRef = useRef<Map<string, number>>(new Map());
  const updateRequestQueueRef = useRef<Map<string, Promise<void>>>(new Map());
  // Per-record count of in-flight generic updates, used to gate the
  // authoritative invalidate until the queue for that record drains.
  const pendingUpdatesRef = useRef<Map<string, number>>(new Map());

  const updateMutation = useMutation<
    MealType,
    Error,
    GenericUpdateVars,
    {
      id: string;
      token: number;
      previousFields: Record<string, unknown>;
      optimisticFields: Record<string, unknown>;
    }
  >({
    mutationFn: ({ id, data, reservation }: GenericUpdateVars) => {
      // Wait for the reserved predecessor slot, then PUT. The slot is
      // released in `finally` so a failed PUT never blocks the next one.
      return reservation.predecessor
        .then(async () => updateMealType(id, data))
        .finally(() => {
          reservation.resolveDone();
        });
    },
    onMutate: ({
      id,
      data,
      token,
      previousFields,
      optimisticFields,
    }: GenericUpdateVars) => {
      // The slot + ownership were already reserved synchronously by
      // `mutateMealType`. Here we only cancel in-flight fetches and then apply
      // the guarded optimistic cache write: a field is written ONLY if this
      // mutation still owns it (a newer mutation may have taken it over while
      // cancelQueries was pending).
      return queryClient
        .cancelQueries({ queryKey: mealTypesQueryKey })
        .then(() => {
          queryClient.setQueryData<MealType[]>(mealTypesQueryKey, (old) =>
            (old ?? []).map((mt) => {
              if (mt.id !== id) return mt;
              const next = { ...mt };
              for (const [field, value] of Object.entries(data)) {
                const key = `${id}:${field}`;
                if (fieldOwnerRef.current.get(key) !== token) continue;
                (next as unknown as Record<string, unknown>)[field] = value;
              }
              return next;
            })
          );
          return { id, token, previousFields, optimisticFields };
        });
    },
    onSuccess: (updated, _vars, ctx) => {
      const context = ctx as {
        id: string;
        token: number;
        optimisticFields: Record<string, unknown>;
      };
      // Apply the server result ONLY for the fields this mutation touched, and
      // only while this mutation still owns each field (a newer mutation that
      // took the field over is never overwritten).
      queryClient.setQueryData<MealType[]>(mealTypesQueryKey, (old) =>
        (old ?? []).map((mt) => {
          if (mt.id !== context.id) return mt;
          const next = { ...mt };
          for (const field of Object.keys(context.optimisticFields)) {
            const key = `${context.id}:${field}`;
            if (fieldOwnerRef.current.get(key) !== context.token) continue;
            (next as unknown as Record<string, unknown>)[field] = (
              updated as unknown as Record<string, unknown>
            )[field];
            // Clear ownership only if we still own it (a newer mutation would
            // have replaced the token and must keep it).
            if (fieldOwnerRef.current.get(key) === context.token) {
              fieldOwnerRef.current.delete(key);
            }
          }
          return next;
        })
      );
    },
    onError: (err: Error, _vars, context) => {
      if (context) {
        // Roll back ONLY the fields this mutation still owns (token match) and
        // restore their previous values; a newer owner is left untouched.
        queryClient.setQueryData<MealType[]>(mealTypesQueryKey, (old) =>
          (old ?? []).map((mt) => {
            if (mt.id !== context.id) return mt;
            const next = { ...mt };
            for (const field of Object.keys(context.optimisticFields)) {
              const key = `${context.id}:${field}`;
              if (fieldOwnerRef.current.get(key) !== context.token) continue;
              (next as Record<string, unknown>)[field] =
                context.previousFields[field];
              if (fieldOwnerRef.current.get(key) === context.token) {
                fieldOwnerRef.current.delete(key);
              }
            }
            return next;
          })
        );
      }
      addLog(`Failed to update meal type: ${err.message}`, 'ERROR');
      Toast.show({
        type: 'error',
        text1: t('mealTypeSettings.failedUpdate', {
          defaultValue: 'Failed to update',
        }),
      });
    },
    onSettled: (_data, _err, vars, context) => {
      // Authoritative reconciliation ONLY after this record's update queue
      // drains — never while a newer mutation for the same record is still
      // pending (an intermediate refetch would overwrite its optimistic cache
      // with older server state). The reorder path uses DIRECT updateMealType()
      // calls and never goes through this mutation.
      const id = context?.id ?? vars.id;
      const pending = pendingUpdatesRef.current.get(id) ?? 0;
      if (pending <= 1) {
        pendingUpdatesRef.current.delete(id);
        queryClient.invalidateQueries({ queryKey: mealTypesQueryKey });
      } else {
        pendingUpdatesRef.current.set(id, pending - 1);
      }
      // Release the reserved slot on EVERY settling path (including an
      // onMutate failure where mutationFn never ran) so the per-record queue
      // can never deadlock. Idempotent for the normal mutationFn path.
      vars.reservation.resolveDone();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMealType(id),
    onSuccess: () => {
      invalidate();
      Toast.show({
        type: 'success',
        text1: t('mealTypeSettings.deleted', {
          defaultValue: 'Meal type deleted',
        }),
      });
    },
    onError: (err: Error) => {
      addLog(`Failed to delete meal type: ${err.message}`, 'ERROR');
      Toast.show({
        type: 'error',
        text1: t('mealTypeSettings.failedDelete', {
          defaultValue: 'Failed to delete',
        }),
      });
    },
  });

  /**
   * Single generic-update wrapper — the ONLY entry point for row Visibility,
   * row default time, and Edit Save.
   *
   * At this SYNCHRONOUS user-action boundary (before any await) we:
   *   1. allocate the mutation token (user-intent order);
   *   2. reserve a per-record queue SLOT (B sees A's `done` immediately, so
   *      PUT order equals user-initiation order regardless of cancelQueries /
   *      network timing);
   *   3. increment the per-record pending counter;
   *   4. reserve field ownership for every modified field;
   *   5. capture rollback metadata (previous values) from the CURRENT cache
   *      at reservation time;
   *   6. invoke the TanStack mutation carrying those internal values.
   *
   * The actual PUT does NOT start here — `mutationFn` waits for the reserved
   * predecessor slot and performs the request. Internal metadata never reaches
   * `updateMealType()`.
   */
  const mutateMealType = useCallback(
    (
      id: string,
      data: Partial<Omit<MealType, 'id'>>,
      options?: { onSuccess?: () => void }
    ) => {
      const token = ++mutationTokenRef.current;

      // 2. Reserve the per-record queue slot synchronously.
      const predecessor =
        updateRequestQueueRef.current.get(id) ?? Promise.resolve();
      let resolveDone!: () => void;
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });
      updateRequestQueueRef.current.set(id, done);
      const reservation: UpdateReservation = { predecessor, done, resolveDone };

      // 3. Pending counter for drain-gated invalidation.
      pendingUpdatesRef.current.set(
        id,
        (pendingUpdatesRef.current.get(id) ?? 0) + 1
      );

      // 4 + 5. Reserve ownership + capture rollback metadata from the CURRENT
      // cache (synchronously, before any async work).
      const previousFields: Record<string, unknown> = {};
      const optimisticFields: Record<string, unknown> = {};
      const current = queryClient.getQueryData<MealType[]>(mealTypesQueryKey);
      for (const field of Object.keys(data)) {
        fieldOwnerRef.current.set(`${id}:${field}`, token);
        optimisticFields[field] = (data as unknown as Record<string, unknown>)[
          field
        ];
        const existing = current?.find((mt) => mt.id === id);
        previousFields[field] = existing
          ? (existing as unknown as Record<string, unknown>)[field]
          : undefined;
      }

      updateMutation.mutate(
        { id, data, token, previousFields, optimisticFields, reservation },
        options
      );
    },
    [updateMutation, queryClient]
  );

  const serverOrder = useMemo(
    () => [...(mealTypes ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [mealTypes]
  );
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const orderedTypes = useMemo(() => {
    if (!orderOverride) return serverOrder;
    const byId = new Map(serverOrder.map((mt) => [mt.id, mt]));
    const ordered = orderOverride
      .map((id) => byId.get(id))
      .filter((mt): mt is MealType => mt != null);
    const included = new Set(ordered.map((mt) => mt.id));
    return [...ordered, ...serverOrder.filter((mt) => !included.has(mt.id))];
  }, [serverOrder, orderOverride]);
  const unifiedRows = useMemo(
    () => orderedTypes.map((mt) => ({ isSystem: mt.user_id === null, mt })),
    [orderedTypes]
  );

  const { strides, offsets } = useReorderRowGeometry(unifiedRows.length);
  const activeDragIndex = useSharedValue(-1);
  const panY = useSharedValue(0);
  const committingTranslate = useSharedValue(0);
  const targetIndex = useDerivedValue(() =>
    activeDragIndex.value < 0
      ? -1
      : computeReorderTargetIndex(
          strides,
          offsets,
          activeDragIndex.value,
          panY.value
        )
  );

  const orderGenerationRef = useRef(0);
  const latestOrderRef = useRef<{ generation: number; order: string[] } | null>(
    null
  );
  const workerRunningRef = useRef(false);
  const pendingDragResetRef = useRef(false);

  const doPersist = useCallback(
    async (order: string[], generation: number) => {
      try {
        const updated = await updateMealTypeOrder(order);
        queryClient.setQueryData<MealType[]>(mealTypesQueryKey, updated);
        if (
          generation === orderGenerationRef.current &&
          latestOrderRef.current === null
        )
          setOrderOverride(null);
        invalidate();
      } catch (err) {
        addLog(
          `Failed to persist meal type order: ${(err as Error).message}`,
          'ERROR'
        );
        Toast.show({
          type: 'error',
          text1: t('mealTypeSettings.failedReorder', {
            defaultValue: 'Failed to reorder meal types',
          }),
        });
        if (
          generation === orderGenerationRef.current &&
          latestOrderRef.current === null
        )
          setOrderOverride(null);
        invalidate();
      }
    },
    [invalidate, queryClient, t]
  );

  const persistWorker = useCallback(async () => {
    workerRunningRef.current = true;
    try {
      while (latestOrderRef.current) {
        const { generation, order } = latestOrderRef.current;
        latestOrderRef.current = null;
        await doPersist(order, generation);
      }
    } finally {
      workerRunningRef.current = false;
      if (latestOrderRef.current) void persistWorker();
    }
  }, [doPersist]);

  const moveMealType = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= unifiedRows.length) return;
      if (toIndex < 0 || toIndex >= unifiedRows.length) return;
      const next = unifiedRows.map((row) => row.mt.id);
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const generation = ++orderGenerationRef.current;
      latestOrderRef.current = { generation, order: next };
      setOrderOverride(next);
      pendingDragResetRef.current = true;
      if (!workerRunningRef.current) void persistWorker();
    },
    [unifiedRows, persistWorker]
  );

  useEffect(() => {
    if (!pendingDragResetRef.current) return;
    pendingDragResetRef.current = false;
    resetReorderDragPreview(activeDragIndex, panY, committingTranslate);
  }, [unifiedRows, committingTranslate, activeDragIndex, panY]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const header = useScreenHeader({
    title: t('navigation.mealTypes', { defaultValue: 'Meal Types' }),
    left: { kind: 'back' },
    right: {
      kind: 'icon',
      sfSymbol: 'plus',
      ionicon: 'add-outline',
      role: 'primary',
      onPress: () => {
        setEditingType(null);
        setIsCreating(false);
        formSheetRef.current?.presentCreate();
      },
      accessibilityLabel: t('mealTypeSettings.add', {
        defaultValue: 'Add meal type',
      }),
      identifier: 'meal-types-add',
    },
  });

  /**
   * Create: ONE logical operation. The initial POST supports name + sort_order
   * + default_time (backend hardcodes is_visible = TRUE and show_in_quick_log
   * defaults true); the requested per-user settings (visibility, quick log)
   * are applied with follow-up updates and the cache is reconciled once.
   */
  const handleCreate = useCallback(
    async (values: {
      name: string;
      defaultTime: string;
      showInQuickLog: boolean;
    }) => {
      setIsCreating(true);
      const nextSort =
        Math.max(0, ...serverOrder.map((type) => type.sort_order)) + 10;
      try {
        const created = await createMealType({
          name: values.name,
          sort_order: nextSort,
          default_time: values.defaultTime || null,
        });
        const followUps: { id: string; data: Partial<Omit<MealType, 'id'>> }[] =
          [];
        // Visibility is owned by the main-list Switch (backend defaults TRUE);
        // only the Quick log choice needs a follow-up update.
        if (!values.showInQuickLog) {
          followUps.push({
            id: created.id,
            data: { show_in_quick_log: false },
          });
        }
        try {
          for (const up of followUps) {
            await updateMealType(up.id, up.data);
          }
        } catch (err) {
          // Partially configured: report accurately and reconcile with server.
          addLog(
            `Failed to apply meal type settings: ${(err as Error).message}`,
            'ERROR'
          );
          Toast.show({
            type: 'error',
            text1: t('mealTypeSettings.createdPartial', {
              defaultValue: 'Created, but some settings failed to save.',
            }),
          });
          formSheetRef.current?.dismiss();
          setEditingType(null);
          setIsCreating(false);
          invalidate();
          return;
        }
        Toast.show({
          type: 'success',
          text1: t('mealTypeSettings.created', {
            defaultValue: 'Meal type created',
          }),
        });
        formSheetRef.current?.dismiss();
        setEditingType(null);
        setIsCreating(false);
        invalidate();
      } catch (err) {
        addLog(
          `Failed to create meal type: ${(err as Error).message}`,
          'ERROR'
        );
        Toast.show({
          type: 'error',
          text1: t('mealTypeSettings.failedCreate', {
            defaultValue: 'Failed to create meal type',
          }),
        });
        setIsCreating(false);
      }
    },
    [serverOrder, invalidate, t]
  );

  /** Edit: name/default_time/quick log/visibility only — sort_order untouched. */
  const handleEditSave = useCallback(
    (values: {
      name: string;
      nameChanged?: boolean;
      defaultTime: string;
      showInQuickLog: boolean;
    }) => {
      if (!editingType) return;
      mutateMealType(
        editingType.id,
        {
          ...(editingType.user_id !== null || values.nameChanged
            ? { name: values.name }
            : {}),
          default_time: values.defaultTime || null,
          // is_visible intentionally omitted: Visibility is owned by the
          // main-list Switch, so a plain edit never overwrites server state.
          show_in_quick_log: values.showInQuickLog,
        },
        {
          onSuccess: () => {
            formSheetRef.current?.dismiss();
            setEditingType(null);
            setIsCreating(false);
            // No explicit invalidate here — the generic updateMutation's
            // onSettled already reconciles the query once.
          },
        }
      );
    },
    [editingType, mutateMealType]
  );

  const handleDelete = useCallback(
    (mt: MealType) => {
      Alert.alert(
        t('mealTypeSettings.deleteTitle', { defaultValue: 'Delete Meal Type' }),
        t('mealTypeSettings.deleteMessage', {
          defaultValue: "Delete '{{name}}'?",
          name: mt.name,
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => deleteMutation.mutate(mt.id),
          },
        ]
      );
    },
    [deleteMutation, t]
  );

  const openEdit = useCallback((mt: MealType) => {
    setEditingType(mt);
    setIsCreating(false);
    formSheetRef.current?.presentEdit(mt);
  }, []);

  const openTimePicker = useCallback(
    (mt: MealType) => {
      timePickerRef.current?.present(
        toHourMinute(mt.default_time) || null,
        (time) => {
          mutateMealType(mt.id, { default_time: time });
        }
      );
    },
    [mutateMealType]
  );

  /** Row-level Visibility switch (mockup placement: main list owns it). */
  const toggleVisibility = useCallback(
    (mt: MealType, value: boolean) => {
      mutateMealType(mt.id, { is_visible: value });
    },
    [mutateMealType]
  );

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-base">
            {t('mealTypeSettings.loading', {
              defaultValue: 'Loading meal types...',
            })}
          </Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-text-muted text-base text-center">
            {t('mealTypeSettings.loadFailed', {
              defaultValue: 'Failed to load meal types.',
            })}
          </Text>
          <TouchableOpacity onPress={() => void refetch()} className="mt-4">
            <Text className="text-accent-primary text-base font-medium">
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
          }}
          contentInsetAdjustmentBehavior={
            usesNativeHeader ? 'automatic' : 'never'
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
            />
          }
        >
          {unifiedRows.length > 0 ? (
            <View className="bg-surface rounded-xl mx-4 overflow-hidden shadow-sm">
              {unifiedRows.map((row, index) => (
                <CustomMealTypeRow
                  key={row.mt.id}
                  mt={row.mt}
                  index={index}
                  totalRows={unifiedRows.length}
                  onEdit={openEdit}
                  onTime={openTimePicker}
                  onMove={moveMealType}
                  onToggleVisibility={toggleVisibility}
                  textMuted={textMuted}
                  textSecondary={textSecondary}
                  activeDragIndex={activeDragIndex}
                  panY={panY}
                  committingTranslate={committingTranslate}
                  targetIndex={targetIndex}
                  strides={strides}
                  t={t}
                />
              ))}
            </View>
          ) : (
            <View className="items-center justify-center py-16 px-8">
              <Text className="text-text-muted text-lg text-center">
                {t('mealTypeSettings.empty', {
                  defaultValue: 'No meal types found',
                })}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <MealTypeFormSheet
        ref={formSheetRef}
        isSystem={editingType != null && editingType.user_id === null}
        isSaving={isCreating || updateMutation.isPending}
        onCreate={handleCreate}
        onEditSave={handleEditSave}
        onDelete={
          editingType && editingType.user_id !== null
            ? () => handleDelete(editingType)
            : undefined
        }
        timePickerRef={timePickerRef}
      />
      <MealTypeTimePickerSheet ref={timePickerRef} />
    </View>
  );
};

/** Right-side Default time: plain settings-row text with a large invisible hit
 * target (full row height via py-3). No nested card/pill, no timer icon, no
 * chevron — the row stays one clean settings row (mockup). */
const MealTypeTimeCell: React.FC<{
  mealType: MealType;
  onPress: () => void;
  textSecondary: string;
  t: ReturnType<typeof useTranslation>['t'];
}> = ({ mealType, onPress, textSecondary, t }) => {
  const time = toHourMinute(mealType.default_time);
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-3 py-3"
      accessibilityRole="button"
      accessibilityLabel={t('mealTypeSettings.defaultTime', {
        defaultValue: 'Default time for {{name}}{{time}}',
        name: getMealTypeDisplayLabel(mealType, t),
        time: time
          ? `, ${time}`
          : `, ${t('mealTypeSettings.notSet', { defaultValue: 'Not set' })}`,
      })}
      testID={`time-cell-${mealType.id}`}
    >
      <Text
        className="text-sm text-text-secondary"
        style={{ minWidth: 44, textAlign: 'right' }}
      >
        {time || t('mealTypeSettings.notSet', { defaultValue: 'Not set' })}
      </Text>
    </TouchableOpacity>
  );
};

export default MealTypeSettingsScreen;
