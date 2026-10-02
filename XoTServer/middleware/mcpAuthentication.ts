import type { RequestHandler } from 'express';
import { auth } from '../auth.js';
import { authenticate } from './authMiddleware.js';
import { dbContextStorage } from '../db/poolManager.js';
import {
  MCP_READ_ONLY_KEY_CONFIG_ID,
  MCP_READ_ONLY_KEY_PREFIX,
} from '../utils/mcpReadOnlyKey.js';
import {
  MCP_AGENT_KEY_CONFIG_ID,
  MCP_AGENT_KEY_PREFIX,
} from '../utils/mcpAgentKey.js';
import { resolveCoachingAgent } from '../services/coachingRunService.js';
import { CoachingForbiddenError } from '../models/coachingRepository.js';

interface McpKeyVerification {
  valid: boolean;
  key?: { id?: string; configId?: string; referenceId?: string } | null;
  error?: {
    code?: string;
    details?: { tryAgainIn?: number };
  } | null;
}

/** Read-only MCP keys have no Better Auth session and cannot enter REST routes. */
export const authenticateMcp: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const bearer =
    typeof authorization === 'string'
      ? /^\s*Bearer\s+([^\s]+)\s*$/i.exec(authorization)?.[1]
      : undefined;
  const token = bearer ?? req.headers['x-api-key'];
  if (
    typeof token !== 'string' ||
    ![MCP_READ_ONLY_KEY_PREFIX, MCP_AGENT_KEY_PREFIX].some((prefix) =>
      token.startsWith(prefix)
    )
  ) {
    return authenticate(req, res, next);
  }

  try {
    const isAgent = token.startsWith(MCP_AGENT_KEY_PREFIX);
    const configId = isAgent
      ? MCP_AGENT_KEY_CONFIG_ID
      : MCP_READ_ONLY_KEY_CONFIG_ID;
    // @ts-expect-error Better Auth's plugin endpoints are missing from InferAPI.
    const result = (await auth.api.verifyApiKey({
      body: { key: token, configId },
    })) as McpKeyVerification;
    if (!result.valid) {
      if (result.error?.code === 'RATE_LIMITED') {
        const retryAfterMs = result.error.details?.tryAgainIn;
        if (
          typeof retryAfterMs === 'number' &&
          Number.isFinite(retryAfterMs) &&
          retryAfterMs > 0
        ) {
          res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
        }
        return res.status(429).json({ error: 'Rate limit exceeded.' });
      }
      if (result.error?.code === 'USAGE_EXCEEDED') {
        return res.status(429).json({ error: 'API key usage limit exceeded.' });
      }
      if (result.error?.code === 'KEY_DISABLED') {
        return res.status(403).json({ error: 'API key is disabled.' });
      }
      if (result.error?.code === 'KEY_EXPIRED') {
        return res.status(401).json({ error: 'API key has expired.' });
      }
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userId =
      result.key?.configId === configId ? result.key.referenceId : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.authenticatedUserId = userId;
    req.originalUserId = userId;
    req.activeUserId = userId;
    req.userId = userId;
    req.user = { id: userId };
    req.mcpReadOnly = true;
    req.credentialKind = isAgent ? 'mcp_agent' : 'mcp_read_only';
    if (isAgent) {
      if (!result.key?.id)
        return res.status(401).json({ error: 'Authentication required.' });
      const agent = await resolveCoachingAgent(userId, {
        keyId: result.key.id,
      });
      req.mcpAgentId = agent.id;
      req.mcpCredentialId = result.key.id;
    }
    return dbContextStorage.run({ authenticatedUserId: userId }, next);
  } catch (error) {
    if (error instanceof CoachingForbiddenError)
      return res.status(403).json({ error: error.message });
    return next(error);
  }
};
