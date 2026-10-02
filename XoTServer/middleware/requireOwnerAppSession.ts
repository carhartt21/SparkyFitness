import type { RequestHandler } from 'express';
import { requireSelfActor } from './requireSelfMiddleware.js';

/** An API key is not an approval identity, even alongside a valid cookie. */
export const requireOwnerAppSession: RequestHandler = (req, res, next) => {
  if (
    req.credentialKind !== 'session' ||
    req.headers['x-api-key'] ||
    req.mcpReadOnly ||
    req.mcpAgentId
  ) {
    res
      .status(403)
      .json({ error: 'Review requires the account owner’s app session.' });
    return;
  }
  requireSelfActor(req, res, next);
};
