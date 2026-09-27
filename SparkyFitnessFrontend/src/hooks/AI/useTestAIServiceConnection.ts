import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { testAIServiceConnection } from '@/api/Settings/aiServiceSettingsService';
import { TestAiServiceConnectionRequest } from '@workspace/shared';

// Inline status rendered next to the Test Connection button.
export type TestConnectionStatus =
  { state: 'success' } | { state: 'error'; message: string } | null;

const quotaCodes = new Set([
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'insufficient_quota',
]);

function failureTranslationKey(
  category: string | undefined,
  status: number | undefined,
  code: string | undefined
): string {
  if (category !== 'upstream_error') {
    return `settings.aiService.test.categories.${category ?? 'unknown'}`;
  }
  if (code === 'network_unreachable') {
    return 'settings.aiService.test.categories.unreachable';
  }
  if (code === 'model_not_found') {
    return 'settings.aiService.test.categories.modelUnavailable';
  }
  if (status === 401) return 'settings.aiService.test.categories.unauthorized';
  if (status === 403) return 'settings.aiService.test.categories.forbidden';
  if (status === 404) return 'settings.aiService.test.categories.notFound';
  if (status === 429) {
    return quotaCodes.has(code ?? '')
      ? 'settings.aiService.test.categories.quota'
      : 'settings.aiService.test.categories.rateLimit';
  }
  if (status === 400) return 'settings.aiService.test.categories.badRequest';
  if (status !== undefined && status >= 500) {
    return 'settings.aiService.test.categories.serverError';
  }
  return 'settings.aiService.test.categories.upstream_error';
}

// Shared hook so the test call + category→message mapping isn't duplicated
// across the parents that own a ServiceForm. Both pages (per-user + global)
// invoke this and thread `testConnection`, `isPending`, and `status` down to
// the form, which renders the result inline rather than via a toast.
export const useTestAIServiceConnection = () => {
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (payload: TestAiServiceConnectionRequest) =>
      testAIServiceConnection(payload),
    // No `meta`: the global MutationCache only toasts when meta.successMessage
    // exists, and we surface the result inline instead. We also omit onError —
    // a thrown error (a rare, UI-illegitimate gate/validation reject) keeps the
    // global MutationCache error toast rather than the inline status.
  });

  // Cleared while a test is in flight so a stale result never lingers over a
  // fresh run; otherwise reflects the most recently completed test.
  let status: TestConnectionStatus = null;
  if (!mutation.isPending && mutation.data) {
    status = mutation.data.ok
      ? { state: 'success' }
      : {
          state: 'error',
          message: t(
            failureTranslationKey(
              mutation.data.category,
              mutation.data.status,
              mutation.data.code
            ),
            t('settings.aiService.test.categories.unknown')
          ),
        };
  }

  // No query invalidation: a test mutates nothing.
  return {
    testConnection: mutation.mutate,
    isPending: mutation.isPending,
    status,
    // Parents own a single page-level instance, so they call this when opening,
    // closing, or switching forms to clear a previous service's stale result.
    reset: mutation.reset,
  };
};
