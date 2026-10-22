import { apiFetch, bindTransportRequestIdentity } from './apiClient';
import { UserProfile } from '../../types/profile';
import { rememberActiveNutritionUser } from '../nutritionIdentity';
import { retryPendingWorkoutExports } from '../workoutHealthExport';
import { addLog } from '../LogService';

/**
 * Fetches the user's profile.
 */
export const fetchProfile = async (): Promise<UserProfile> => {
  const binding = await bindTransportRequestIdentity();
  try {
    const profile = await apiFetch<UserProfile>({
      endpoint: '/api/identity/profiles',
      serviceName: 'Profile API',
      operation: 'fetch profile',
      expectedIdentity: binding,
    });
    await binding.assertCurrent();
    if (!profile || typeof profile.id !== 'string' || !profile.id.trim())
      throw new TypeError('Invalid profile response.');
    await rememberActiveNutritionUser(profile.id, binding);
    await binding.assertCurrent();
    void retryPendingWorkoutExports().catch((error) => {
      addLog(
        `[Profile] Workout Health export retry failed: ${String(error)}`,
        'WARNING'
      );
    });
    return profile;
  } finally {
    binding.release();
  }
};
