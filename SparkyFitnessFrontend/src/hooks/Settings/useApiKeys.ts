import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authClient } from '@/lib/auth-client';
import { apiKeyKeys } from '@/api/keys/settings';

export interface ApiKeyRecord {
  id: string;
  name: string | null;
  enabled: boolean;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  expiresAt: string | Date | null;
  configId?: string | null;
}

export type ApiKeyScope = 'full' | 'mcp-read-only';
const configIdForScope = (scope: ApiKeyScope) =>
  scope === 'mcp-read-only' ? 'mcp-read-only' : 'default';

export const useApiKeysQuery = (userId?: string) => {
  const { t } = useTranslation();

  return useQuery<ApiKeyRecord[]>({
    queryKey: apiKeyKeys.lists(),
    queryFn: async (): Promise<ApiKeyRecord[]> => {
      const { data, error } = await authClient.apiKey.list();
      if (error) throw error;
      return (data?.apiKeys || []) as ApiKeyRecord[];
    },
    enabled: !!userId,
    meta: {
      errorMessage: t(
        'settings.apiKeyManagement.loadError',
        'Failed to load API keys'
      ),
    },
  });
};

export const useCreateApiKeyMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      name,
      expiresIn,
      scope,
    }: {
      name: string;
      expiresIn?: number;
      scope: ApiKeyScope;
    }) => {
      const { data, error } = await authClient.apiKey.create({
        name,
        expiresIn,
        configId: configIdForScope(scope),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
    meta: {
      successMessage: t(
        'settings.apiKeyManagement.createSuccess',
        "New API key generated successfully! Please copy it now as it won't be shown again."
      ),
      errorMessage: t(
        'settings.apiKeyManagement.createError',
        'Failed to generate API key'
      ),
    },
  });
};

export const useDeleteApiKeyMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      keyId,
      configId,
    }: {
      keyId: string;
      configId?: string | null;
    }) => {
      const { error } = await authClient.apiKey.delete({
        keyId,
        configId: configId || 'default',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
    meta: {
      successMessage: t(
        'settings.apiKeyManagement.deleteSuccess',
        'API key deleted successfully!'
      ),
      errorMessage: t(
        'settings.apiKeyManagement.deleteError',
        'Failed to delete API key'
      ),
    },
  });
};

export const useToggleApiKeyMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      keyId,
      enabled,
      configId,
    }: {
      keyId: string;
      enabled: boolean;
      configId?: string | null;
    }) => {
      const { error } = await authClient.apiKey.update({
        keyId,
        enabled,
        configId: configId || 'default',
      });
      if (error) throw error;
      return enabled;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
    meta: {
      successMessage: t(
        'settings.apiKeyManagement.updateSuccess',
        'API key status updated successfully!'
      ),
      errorMessage: t(
        'settings.apiKeyManagement.updateError',
        'Failed to update API key'
      ),
    },
  });
};

interface ApiKeyPlugin {
  deleteAllExpiredApiKeys: (
    options: Record<string, unknown>
  ) => Promise<{ error: unknown }>;
}

export const useCleanupApiKeysMutation = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const { error } = await (
        authClient.apiKey as unknown as ApiKeyPlugin
      ).deleteAllExpiredApiKeys({});
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
    meta: {
      successMessage: t(
        'settings.apiKeyManagement.cleanupSuccess',
        'All expired API keys have been removed.'
      ),
      errorMessage: t(
        'settings.apiKeyManagement.cleanupError',
        'Failed to cleanup keys'
      ),
    },
  });
};
