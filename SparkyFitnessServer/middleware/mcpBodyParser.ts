import express, { type RequestHandler } from 'express';
import { isDemoMode } from './demoGuardMiddleware.js';

// Read-only tools accept small JSON arguments. Full MCP sessions also support
// image tools whose base64 payloads need the larger application limit.
const parseReadOnlyBody = express.json({ limit: '1mb' });
const parseFullBody = express.json({ limit: '50mb' });

/** Parse only after authentication has selected the credential's tool scope. */
export const parseMcpBody: RequestHandler = (req, res, next) => {
  const parser =
    req.mcpReadOnly === true || isDemoMode()
      ? parseReadOnlyBody
      : parseFullBody;
  parser(req, res, next);
};
