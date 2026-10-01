import {
  continueMcpAuthorization,
  fetchMcpPublicClient,
  submitMcpConsent,
} from '@/api/Auth/auth';
import { readMcpAuthorizationRedirect } from '@/api/Auth/mcpAuthorizationResponse';

/** Keeps OAuth network access behind the frontend's hooks/API boundary. */
export function useMcpAuthorization() {
  return {
    continueMcpAuthorization,
    fetchMcpPublicClient,
    submitMcpConsent,
    readMcpAuthorizationRedirect,
  };
}
