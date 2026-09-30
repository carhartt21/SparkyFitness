import {
  fetchEngagementSettings,
  fetchEngagementStatus,
  fetchMcpConnections,
  patchEngagementSettings,
  revokeMcpConnection,
} from '@/api/Engagement/engagement';

export function useEngagementApi() {
  return {
    fetchEngagementSettings,
    fetchEngagementStatus,
    fetchMcpConnections,
    patchEngagementSettings,
    revokeMcpConnection,
  };
}
