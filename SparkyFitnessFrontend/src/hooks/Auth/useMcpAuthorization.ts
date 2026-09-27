import {
  continueMcpAuthorization,
  fetchMcpPublicClient,
  submitMcpConsent,
} from '@/api/Auth/auth';

/** Keeps OAuth network access behind the frontend's hooks/API boundary. */
export function useMcpAuthorization() {
  return { continueMcpAuthorization, fetchMcpPublicClient, submitMcpConsent };
}
