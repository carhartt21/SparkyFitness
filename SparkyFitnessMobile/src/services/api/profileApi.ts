import { apiFetch } from './apiClient';
import { UserProfile } from '../../types/profile';
import { rememberActiveNutritionUser } from '../nutritionIdentity';

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
  return profile;
};
