import type { RequestHandler } from 'express';
import { MCP_READ_ONLY_KEY_PREFIX } from '../utils/mcpReadOnlyKey.js';
import { MCP_AGENT_KEY_PREFIX } from '../utils/mcpAgentKey.js';

/** The MCP mount runs before this guard; no other route accepts its keys. */
export const rejectMcpReadOnlyCredential: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization;
  const bearer =
    typeof authorization === 'string'
      ? /^\s*Bearer\s+([^\s]+)\s*$/i.exec(authorization)?.[1]
      : undefined;
  const apiKey = req.headers['x-api-key'];
  if (
    [MCP_READ_ONLY_KEY_PREFIX, MCP_AGENT_KEY_PREFIX].some(
      (prefix) =>
        bearer?.startsWith(prefix) ||
        (typeof apiKey === 'string' && apiKey.startsWith(prefix))
    )
  ) {
    res.status(403).json({ error: 'MCP-only credential is not valid here.' });
    return;
  }
  next();
};
