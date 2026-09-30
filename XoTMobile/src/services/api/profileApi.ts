import { apiFetch } from './apiClient';
import { UserProfile } from '../../types/profile';
import { rememberActiveNutritionUser } from '../nutritionIdentity';
import { retryPendingWorkoutExports } from '../workoutHealthExport';
import { addLog } from '../LogService';

/**
 * Fetches the user's profile.
 */
export const fetchProfile = async (): Promise<UserProfile> => {
  const profile = await apiFetch<UserProfile>({
    endpoint: '/api/identity/profiles',
    serviceName: 'Profile API',
    operation: 'fetch profile',
  });
  await rememberActiveNutritionUser(profile.id);
  void retryPendingWorkoutExports().catch((error) => {
    addLog(
      `[Profile] Workout Health export retry failed: ${String(error)}`,
      'WARNING'
    );
  });
  return profile;
};
