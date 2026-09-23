import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { CreateFoodEntryPayload } from './api/foodEntriesApi';
import { newUuid } from '../utils/ids';

const PREFIX = '@SparkyFitness/nutrition-action/v1/';

// Strict parsing is intentional: an API payload with an unexpected credential
// or session field must never be written into the action store.
const foodPayloadSchema = z.strictObject({
  client_operation_id: z.uuid(),
  meal_type_id: z.string().min(1),
  quantity: z.number().finite().positive(),
  unit: z.string(),
  entry_date: z.iso.date(),
  entry_time: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  food_id: z.string().optional(),
  variant_id: z.string().optional(),
  food_name: z.string().optional(),
  brand_name: z.string().optional(),
  serving_size: z.number().finite().optional(),
  serving_unit: z.string().optional(),
  calories: z.number().finite().optional(),
  protein: z.number().finite().optional(),
  carbs: z.number().finite().optional(),
  fat: z.number().finite().optional(),
  saturated_fat: z.number().finite().optional(),
  sodium: z.number().finite().optional(),
  dietary_fiber: z.number().finite().optional(),
  sugars: z.number().finite().optional(),
  trans_fat: z.number().finite().optional(),
  potassium: z.number().finite().optional(),
  calcium: z.number().finite().optional(),
  iron: z.number().finite().optional(),
  caffeine_mg: z.number().finite().optional(),
  water_ml: z.number().finite().optional(),
  alcohol_g: z.number().finite().optional(),
  cholesterol: z.number().finite().optional(),
  vitamin_a: z.number().finite().optional(),
  vitamin_c: z.number().finite().optional(),
  custom_nutrients: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .nullable()
    .optional(),
  meal_id: z.string().optional(),
});

const actionSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('logFoodEntry'),
  clientOperationId: z.uuid(),
  serverConfigId: z.string().min(1),
  userId: z.string().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  payload: foodPayloadSchema,
  syncState: z.enum(['pending', 'syncing', 'attentionRequired', 'synced']),
  retryCount: z.number().int().nonnegative(),
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  lastError: z
    .enum(['network', 'server', 'auth', 'validation', 'storage'])
    .nullable(),
  serverIdentity: z.string().nullable(),
});

export type PendingNutritionAction = z.infer<typeof actionSchema>;
export type NutritionActionErrorClass = NonNullable<
  PendingNutritionAction['lastError']
>;
export type NutritionActionIdentity = Pick<
  PendingNutritionAction,
  'serverConfigId' | 'userId'
>;

export class NutritionOutboxCorruptError extends Error {
  constructor() {
    super(
      'A nutrition action could not be read; it was preserved for recovery.'
    );
  }
}

const keyFor = (identity: NutritionActionIdentity, operationId: string) =>
  `${PREFIX}${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}/${operationId}`;
const prefixFor = (identity: NutritionActionIdentity) =>
  `${PREFIX}${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}/`;

// Serialize all read-modify-write transitions. Each action uses its own key so
// two enqueues never overwrite a shared document. Storage rejection propagates.
let tail: Promise<void> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

const listeners = new Set<() => void>();
function changed() {
  listeners.forEach((listener) => listener());
}
export function subscribeNutritionActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parseAction(raw: string): PendingNutritionAction {
  try {
    const parsed: unknown = JSON.parse(raw);
    // Version switching is explicit so future releases can migrate records
    // instead of treating an unfamiliar action as an empty outbox.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== 1
    ) {
      throw new NutritionOutboxCorruptError();
    }
    const action = actionSchema.parse(parsed);
    if (action.payload.client_operation_id !== action.clientOperationId) {
      throw new NutritionOutboxCorruptError();
    }
    return action;
  } catch {
    throw new NutritionOutboxCorruptError();
  }
}

async function read(key: string): Promise<PendingNutritionAction | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const action = parseAction(raw);
  if (keyFor(action, action.clientOperationId) !== key) {
    throw new NutritionOutboxCorruptError();
  }
  return action;
}

async function save(
  key: string,
  action: PendingNutritionAction
): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(actionSchema.parse(action)));
  changed();
}

export interface EnqueueFoodInput extends NutritionActionIdentity {
  payload: CreateFoodEntryPayload;
  occurredAt: string;
  clientOperationId?: string;
}

export function enqueueFoodEntry(
  input: EnqueueFoodInput
): Promise<PendingNutritionAction> {
  return serialized(async () => {
    const clientOperationId = input.clientOperationId ?? newUuid();
    const key = keyFor(input, clientOperationId);
    const payload = foodPayloadSchema.parse({
      ...input.payload,
      client_operation_id: clientOperationId,
    });
    const existing = await read(key);
    if (existing) {
      if (JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
        throw new Error(
          'Operation ID already belongs to a different food action.'
        );
      }
      return existing;
    }
    const now = new Date().toISOString();
    const action = actionSchema.parse({
      version: 1,
      type: 'logFoodEntry',
      clientOperationId,
      serverConfigId: input.serverConfigId,
      userId: input.userId,
      occurredAt: input.occurredAt,
      createdAt: now,
      payload,
      syncState: 'pending',
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
      serverIdentity: null,
    });
    await save(key, action);
    return action;
  });
}

export function listNutritionActions(
  identity: NutritionActionIdentity
): Promise<PendingNutritionAction[]> {
  return serialized(async () => {
    const prefix = prefixFor(identity);
    const keys = (await AsyncStorage.getAllKeys())
      .filter((key) => key.startsWith(prefix))
      .sort();
    const values = await AsyncStorage.multiGet(keys);
    const actions = values.flatMap(([key, raw]) => {
      if (raw === null) return [];
      const action = parseAction(raw);
      if (keyFor(action, action.clientOperationId) !== key) {
        throw new NutritionOutboxCorruptError();
      }
      return [action];
    });
    return actions.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.clientOperationId.localeCompare(b.clientOperationId)
    );
  });
}

export async function listPendingNutritionActions(
  identity: NutritionActionIdentity
): Promise<PendingNutritionAction[]> {
  const actions = await listNutritionActions(identity);
  return actions.filter(
    (action) => action.syncState === 'pending' || action.syncState === 'syncing'
  );
}

function transition(
  identity: NutritionActionIdentity,
  operationId: string,
  update: (action: PendingNutritionAction) => PendingNutritionAction
): Promise<PendingNutritionAction> {
  return serialized(async () => {
    const key = keyFor(identity, operationId);
    const current = await read(key);
    if (!current) throw new Error('Nutrition action is missing.');
    const next = update(current);
    await save(key, next);
    return next;
  });
}

export function markNutritionActionSyncing(
  identity: NutritionActionIdentity,
  operationId: string
): Promise<PendingNutritionAction> {
  return transition(identity, operationId, (action) => ({
    ...action,
    syncState: 'syncing',
    retryCount: action.retryCount + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  }));
}

export function markNutritionActionPending(
  identity: NutritionActionIdentity,
  operationId: string,
  reason: NutritionActionErrorClass
): Promise<PendingNutritionAction> {
  return transition(identity, operationId, (action) => ({
    ...action,
    syncState: 'pending',
    lastError: reason,
  }));
}

export function markNutritionActionAttentionRequired(
  identity: NutritionActionIdentity,
  operationId: string,
  reason: NutritionActionErrorClass
): Promise<PendingNutritionAction> {
  return transition(identity, operationId, (action) => ({
    ...action,
    syncState: 'attentionRequired',
    lastError: reason,
  }));
}

export function retryNutritionAction(
  identity: NutritionActionIdentity,
  operationId: string
): Promise<PendingNutritionAction> {
  return transition(identity, operationId, (action) => ({
    ...action,
    syncState: 'pending',
    lastError: null,
  }));
}

export function markNutritionActionSynced(
  identity: NutritionActionIdentity,
  operationId: string,
  serverIdentity: string
): Promise<PendingNutritionAction> {
  if (!serverIdentity)
    return Promise.reject(new Error('Server identity is required.'));
  return transition(identity, operationId, (action) => ({
    ...action,
    syncState: 'synced',
    serverIdentity,
    lastError: null,
  }));
}

/** Remove only after a matching server entry is visible in the diary. */
export function acknowledgeNutritionActionVisible(
  identity: NutritionActionIdentity,
  operationId: string,
  serverIdentity: string
): Promise<boolean> {
  return serialized(async () => {
    const key = keyFor(identity, operationId);
    const action = await read(key);
    if (
      !action ||
      action.syncState !== 'synced' ||
      action.serverIdentity !== serverIdentity
    )
      return false;
    await AsyncStorage.removeItem(key);
    changed();
    return true;
  });
}
