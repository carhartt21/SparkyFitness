import express from 'express';
import { COACHING_MCP_PATH, COACHING_MCP_SCOPES } from '@workspace/shared';
import { auth, mcpCoachingOAuthResource } from '../auth.js';
import { createChatgptMcpRoutes } from './chatgptMcpRoutes.js';

/** Discovery contains only public configuration, never credentials or grants. */
export const coachingMcpDiscovery = express.Router();
coachingMcpDiscovery.get(
  `/.well-known/oauth-protected-resource${COACHING_MCP_PATH}`,
  (_req, res) => {
    const issuer = auth.options.baseURL;
    if (!mcpCoachingOAuthResource || typeof issuer !== 'string') {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.set('Cache-Control', 'no-store').json({
      resource: mcpCoachingOAuthResource,
      authorization_servers: [issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: COACHING_MCP_SCOPES,
    });
  }
);

export default createChatgptMcpRoutes(mcpCoachingOAuthResource, true);
