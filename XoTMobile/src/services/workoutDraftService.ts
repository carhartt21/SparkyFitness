import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { addLog } from './LogService';
import i18n from '../localization/i18n';
import type { FormDraft } from '../types/drafts';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const DRAFT_PREFIX = '@SparkyFitness/session-draft/v2/';
// The old @SessionDraft value has no account owner, so it cannot be restored
// safely into a verified account. Leave it intact for manual recovery.
let operationTail: Promise<void> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = operationTail.then(work, work);
  operationTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export type DraftIdentity = NutritionActionIdentity;

function sameIdentity(a: DraftIdentity, b: DraftIdentity): boolean {
  return a.serverConfigId === b.serverConfigId && a.userId === b.userId;
}

function keyFor(identity: DraftIdentity): string {
  return `${DRAFT_PREFIX}${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}`;
}

export async function getActiveDraftIdentity(): Promise<DraftIdentity | null> {
  return getActiveNutritionIdentity().catch(() => null);
}

async function verifiedIdentity(
  expected?: DraftIdentity
): Promise<DraftIdentity | null> {
  const active = await getActiveDraftIdentity();
  if (!active || (expected && !sameIdentity(active, expected))) return null;
  return active;
}

export type { FormDraft } from '../types/drafts';

export async function loadDraft(
  identity?: DraftIdentity
): Promise<FormDraft | null> {
  return serialize(async () => {
    try {
      const active = await verifiedIdentity(identity);
      if (!active) return null;
      const raw = await AsyncStorage.getItem(keyFor(active));
      if (!raw) return null;
      if (!(await verifiedIdentity(active))) return null;
      return JSON.parse(raw) as FormDraft;
    } catch {
      return null;
    }
  });
}

export async function saveDraft(
  draft: FormDraft,
  identity?: DraftIdentity
): Promise<void> {
  return serialize(async () => {
    try {
      const active = await verifiedIdentity(identity);
      if (!active) return;
      await AsyncStorage.setItem(keyFor(active), JSON.stringify(draft));
    } catch (error) {
      addLog(`Failed to save draft: ${error}`, 'ERROR');
      Toast.show({
        type: 'error',
        text1: i18n.t('workoutDraft.saveFailed', {
          defaultValue: 'Failed to save draft',
        }),
        text2: i18n.t('common.tryAgain', { defaultValue: 'Please try again.' }),
      });
    }
  });
}

export async function clearDraft(identity?: DraftIdentity): Promise<void> {
  return serialize(async () => {
    const active = await verifiedIdentity(identity);
    if (!active) return;
    await AsyncStorage.removeItem(keyFor(active));
  });
}

export async function loadActiveDraft(
  identity?: DraftIdentity
): Promise<FormDraft | null> {
  const draft = await loadDraft(identity);
  if (!draft) return null;
  if (draft.type === 'workout' && draft.exercises.length > 0) return draft;
  if (draft.type === 'activity' && draft.exerciseId != null) return draft;
  return null;
}
