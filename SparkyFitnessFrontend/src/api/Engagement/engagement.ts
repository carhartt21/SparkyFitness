import type { EngagementSettingsPatch } from '@workspace/shared';

export function fetchEngagementSettings(): Promise<Response> {
  return fetch('/api/v2/engagement/settings', { credentials: 'include' });
}

export function patchEngagementSettings(
  patch: EngagementSettingsPatch
): Promise<Response> {
  return fetch('/api/v2/engagement/settings', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function fetchMcpConnections(): Promise<Response> {
  return fetch('/api/v2/mcp/connections', { credentials: 'include' });
}

export function revokeMcpConnection(id: string): Promise<Response> {
  return fetch(`/api/v2/mcp/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}
