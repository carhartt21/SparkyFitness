import type { EngagementSettingsPatchV2 } from '@workspace/shared';

export function fetchEngagementSettings(): Promise<Response> {
  return fetch('/api/v2/engagement/settings?version=2', {
    credentials: 'include',
  });
}

export function patchEngagementSettings(
  patch: EngagementSettingsPatchV2
): Promise<Response> {
  return fetch('/api/v2/engagement/settings?version=2', {
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

export function fetchEngagementStatus(): Promise<Response> {
  return fetch('/api/v2/engagement/status', { credentials: 'include' });
}
