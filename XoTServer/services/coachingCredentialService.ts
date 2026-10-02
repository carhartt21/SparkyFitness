import { z } from 'zod';
import { auth } from '../auth.js';
import { MCP_AGENT_KEY_CONFIG_ID } from '../utils/mcpAgentKey.js';
import {
  coachingTransaction,
  coachingEvent,
  CoachingForbiddenError,
} from '../models/coachingRepository.js';
import {
  readCoachingAgent,
  mapCoachingAgent,
  requireCoachingEnabled,
} from './coachingRunService.js';

/** Return the credential once. Only a server-created owner/agent binding grants access. */
export async function createCoachingCredential(
  userId: string,
  agentId: string,
  expiresIn: number
) {
  requireCoachingEnabled();
  const agent = await coachingTransaction(
    userId,
    (client) => readCoachingAgent(client, userId, agentId),
    true
  );
  if (agent.oauth_client_id)
    throw new CoachingForbiddenError(
      'OAuth connections cannot issue an API-key credential.'
    );
  // @ts-expect-error Better Auth's API-key plugin endpoints are missing from InferAPI.
  const result: unknown = await auth.api.createApiKey({
    body: {
      userId,
      name: agent.name,
      configId: MCP_AGENT_KEY_CONFIG_ID,
      expiresIn,
    },
  });
  const key = z
    .object({ id: z.string().min(1), key: z.string().min(1) })
    .parse(result);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const updated = await coachingTransaction(userId, async (client) => {
    const current = await readCoachingAgent(client, userId, agentId);
    if (current.key_id)
      await client.query(
        'UPDATE api_key SET enabled=false WHERE id=$1 AND reference_id=$2 AND config_id=$3',
        [current.key_id, userId, MCP_AGENT_KEY_CONFIG_ID]
      );
    const rows = await client.query<typeof agent>(
      'UPDATE coaching_agents SET key_id=$3,expires_at=$4 WHERE user_id=$1 AND id=$2 RETURNING *',
      [userId, agentId, key.id, expiresAt]
    );
    await coachingEvent(client, userId, 'credential_rotated', {
      agentId,
      expiresAt: expiresAt.toISOString(),
    });
    return mapCoachingAgent(rows.rows[0]);
  });
  return { agent: updated, key: key.key, scope: 'mcp-agent' as const };
}
