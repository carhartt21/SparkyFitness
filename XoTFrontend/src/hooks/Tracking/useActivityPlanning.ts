import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyProgressKeys } from '@/api/keys/diary';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import {
  getActivityPlanning,
  resolveActivityPlanning,
} from '@/api/ActivityPlanning/activityPlanning';
export function useActivityPlanning(from: string, to: string) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [
      ...dailyProgressKeys.all,
      'activityPlanning',
      activeUserId,
      from,
      to,
    ],
    queryFn: () => getActivityPlanning(from, to),
    enabled: !!activeUserId && !isActingOnBehalf,
    staleTime: 30000,
  });
  const mutation = useMutation({
    mutationFn: resolveActivityPlanning,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: dailyProgressKeys.all }),
    onError: () =>
      client.invalidateQueries({ queryKey: dailyProgressKeys.all }),
  });
  return { query, mutation, isActingOnBehalf };
}
