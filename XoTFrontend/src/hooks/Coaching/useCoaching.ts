import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import * as api from '@/api/Coaching/coaching';
import type { CoachingReferenceKind } from '@workspace/shared';

export function useCoachingSettings() {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'settings'],
    queryFn: api.loadCoachingSettings,
    enabled: !!activeUserId && !isActingOnBehalf,
  });
}
export function useCoachingRefresh() {
  const client = useQueryClient();
  // Approval can mutate any selected wellness domain. Refresh all dependent
  // libraries, plan templates, counts and diary summaries as one family.
  return () => client.invalidateQueries();
}

export function useCoachingActions() {
  return api;
}
export function useCoachingEvidence(proposalId: string) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'evidence', proposalId],
    queryFn: () => api.loadCoachingEvidence(proposalId),
    enabled: !!activeUserId && !isActingOnBehalf,
  });
}
export function useCoachingPlanning(
  kind: CoachingReferenceKind,
  search: string
) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useInfiniteQuery({
    queryKey: ['coaching', activeUserId, 'choices', kind, search],
    initialPageParam: 0,
    enabled: !!activeUserId && !isActingOnBehalf,
    queryFn: ({ pageParam }) =>
      api.loadCoachingPlanning(kind, search, pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
}
export function useCoachingInbox(
  tab: string,
  domain: string,
  enabled: boolean
) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useInfiniteQuery({
    queryKey: ['coaching', activeUserId, 'inbox', tab, domain],
    enabled:
      enabled && !isActingOnBehalf && tab !== 'settings' && tab !== 'recaps',
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.loadCoachingInbox(
        pageParam,
        tab === 'active' || tab === 'history' ? tab : 'pending',
        domain || undefined
      ),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
}
export function useCoachingContext() {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'run-status'],
    queryFn: api.loadCoachingContext,
    enabled: !!activeUserId && !isActingOnBehalf,
    refetchInterval: 60000,
  });
}
export function usePlannedMeals(day: string, enabled: boolean) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'planned-meals', day],
    queryFn: () => api.loadPlannedMeals(day),
    enabled: enabled && !isActingOnBehalf,
  });
}

export function useCoachingConnections() {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'connections'],
    queryFn: api.loadCoachingConnections,
    enabled: !!activeUserId && !isActingOnBehalf,
  });
}
export function useCoachingRecaps() {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useInfiniteQuery({
    queryKey: ['coaching', activeUserId, 'recaps'],
    enabled: !!activeUserId && !isActingOnBehalf,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.loadCoachingRecaps(pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
}
export function useCoachingRecap(id: string | null) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['coaching', activeUserId, 'recap', id],
    enabled: !!activeUserId && !isActingOnBehalf && !!id,
    queryFn: () => api.loadCoachingRecap(id!),
  });
}
