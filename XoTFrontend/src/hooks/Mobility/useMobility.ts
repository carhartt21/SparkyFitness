import { dailyProgressKeys } from '@/api/keys/diary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { loadMobility, saveMobility } from '@/api/Mobility/mobility';
import { searchExercises } from '@/api/Exercises/exerciseSearchService';
export function useMobility(from: string, to: string) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['mobility', activeUserId, from, to],
    enabled: !!activeUserId && !isActingOnBehalf,
    queryFn: () => loadMobility(from, to),
  });
  const mutation = useMutation({
    mutationFn: saveMobility,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['mobility'] }),
        client.invalidateQueries({ queryKey: dailyProgressKeys.all }),
      ]);
    },
  });
  return { query, mutation };
}
export function useMobilityExerciseSearch(query: string) {
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  return useQuery({
    queryKey: ['mobility-exercises', activeUserId, query],
    enabled: !!activeUserId && !isActingOnBehalf && query.length >= 2,
    queryFn: () => searchExercises(query),
  });
}
