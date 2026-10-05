// Synthetic review-only transport. Never imported by the production entrypoint.
import {
  defaultCoachingSettingsV2,
  coachingSettingsResponseV2Schema,
  coachingContextV2Schema,
  coachingRecapSchema,
  coachingRecapListSchema,
} from '@workspace/shared';
const id = '00000000-0000-4000-8000-000000000091';
const settings = { ...defaultCoachingSettingsV2, enabled: true };
const recap = coachingRecapSchema.parse({
  id,
  kind: 'daily',
  from: '2026-10-04',
  to: '2026-10-04',
  createdAt: '2026-10-05T08:00:00Z',
  readAt: null,
  proposalIds: [],
  title: 'Dein Tagesrückblick',
  summary:
    'Ein ruhiger Tag mit bewusst eingeplanten Pausen. Für heute ist keine Planänderung nötig.',
  observations: [],
  limitations: [
    'Die synchronisierten Aufzeichnungen können unvollständig sein. Fehlende Werte sind unbekannt.',
  ],
  evidence: [],
});
export function createCoachingReviewFixture() {
  let readAt: string | null = null;
  return (url: URL, method: string): unknown | undefined => {
    const path = url.pathname.replace('/api/v2/coaching', '');
    if (!url.pathname.startsWith('/api/v2/coaching')) return undefined;
    if (method === 'GET' && path === '/settings')
      return coachingSettingsResponseV2Schema.parse({
        settings,
        agents: [],
        reconsiderTopics: [],
        featureEnabled: true,
        timezone: 'Europe/Berlin',
      });
    if (method === 'GET' && path === '/context')
      return coachingContextV2Schema.parse({
        enabled: true,
        protocolVersion: 2,
        timezone: 'Europe/Berlin',
        today: '2026-10-05',
        settings,
        agent: null,
        due: null,
        runs: [],
        proposals: [],
        commitments: [],
        events: [],
        nextEventCursor: 0,
        processedEventCursor: 0,
        nextProposalOffset: null,
        nextCommitmentOffset: null,
        reconsiderTopics: [],
      });
    if (method === 'GET' && path === '/planned-meals') return [];
    if (method === 'GET' && path === '/connections') return { connections: [] };
    if (method === 'GET' && path === '/recaps')
      return coachingRecapListSchema.parse({
        recaps: [{ ...recap, readAt }],
        nextOffset: null,
        unreadCount: readAt ? 0 : 1,
      });
    if (method === 'GET' && path === `/recaps/${id}`)
      return { ...recap, readAt };
    if (method === 'POST' && path === `/recaps/${id}/read`) {
      readAt = '2026-10-05T09:00:00Z';
      return { ...recap, readAt };
    }
    throw new Error(`Unsupported coaching review operation: ${method} ${path}`);
  };
}
