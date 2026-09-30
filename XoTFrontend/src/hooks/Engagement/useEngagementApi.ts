import {
  fetchEngagementSettings,
  fetchMcpConnections,
  patchEngagementSettings,
  revokeMcpConnection,
} from '@/api/Engagement/engagement';

export function useEngagementApi() {
  return {
    fetchEngagementSettings,
    fetchMcpConnections,
    patchEngagementSettings,
    revokeMcpConnection,
  };
}
