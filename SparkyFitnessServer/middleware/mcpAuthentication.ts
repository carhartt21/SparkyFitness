import type { RequestHandler } from 'express';
import { auth } from '../auth.js';
import { authenticate } from './authMiddleware.js';
import { dbContextStorage } from '../db/poolManager.js';
import {
  MCP_READ_ONLY_KEY_CONFIG_ID,
  MCP_READ_ONLY_KEY_PREFIX,
} from '../utils/mcpReadOnlyKey.js';

/** Read-only MCP keys have no Better Auth session and cannot enter REST routes. */
export const authenticateMcp: RequestHandler = async (req, res, next) => {
  const bearer = req.headers.authorization;
  const token =
    typeof bearer === 'string' && bearer.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : req.headers['x-api-key'];
  if (
    typeof token !== 'string' ||
    !token.startsWith(MCP_READ_ONLY_KEY_PREFIX)
  ) {
    return authenticate(req, res, next);
  }

  try {
    // @ts-expect-error Better Auth's plugin endpoints are missing from InferAPI.
    const result = await auth.api.verifyApiKey({
      body: { key: token, configId: MCP_READ_ONLY_KEY_CONFIG_ID },
    });
    const userId =
      result.valid && result.key?.configId === MCP_READ_ONLY_KEY_CONFIG_ID
        ? result.key.referenceId
        : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.authenticatedUserId = userId;
    req.originalUserId = userId;
    req.activeUserId = userId;
    req.userId = userId;
    req.user = { id: userId };
    req.mcpReadOnly = true;
    return dbContextStorage.run({ authenticatedUserId: userId }, next);
  } catch (error) {
    return next(error);
  }
};
