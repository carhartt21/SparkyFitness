import express from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { mcpOAuthResource } from '../../auth.js';
import { getSystemClient } from '../../db/poolManager.js';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';

const router = express.Router();
router.use(requireSelfActor);

router.get('/', async (req, res, next) => {
  if (!mcpOAuthResource)
    return void res.status(503).json({ error: 'mcp_oauth_not_configured' });
  const client: PoolClient = await getSystemClient();
  try {
    const result = await client.query(
      `SELECT c.id, c."clientId", COALESCE(NULLIF(o.name, ''), o."clientId") AS name,
              c.scopes, c."createdAt"
       FROM "oauthConsent" c JOIN "oauthClient" o ON o."clientId" = c."clientId"
       WHERE c."userId" = $1 AND (c.scopes ? 'mcp:read' OR c.scopes ? 'mcp:write' OR c.scopes ? 'mcp:propose')
       ORDER BY c."createdAt" DESC`,
      [req.authenticatedUserId]
    );
    res.json({
      connections: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.name,
        client_id: row.clientId,
        scopes: row.scopes,
        created_at: row.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  if (!mcpOAuthResource)
    return void res.status(503).json({ error: 'mcp_oauth_not_configured' });
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success)
    return void res.status(400).json({ error: 'invalid_connection' });
  const client: PoolClient = await getSystemClient();
  try {
    await client.query('BEGIN');
    const consent = await client.query(
      `SELECT "clientId" FROM "oauthConsent"
       WHERE id = $1 AND "userId" = $2 AND (scopes ? 'mcp:read' OR scopes ? 'mcp:write' OR scopes ? 'mcp:propose')
       FOR UPDATE`,
      [id.data, req.authenticatedUserId]
    );
    if (!consent.rows[0]) {
      await client.query('ROLLBACK');
      return void res.status(404).json({ error: 'connection_not_found' });
    }
    const clientId = consent.rows[0].clientId as string;
    await client.query(
      `UPDATE "oauthAccessToken" SET revoked = NOW()
       WHERE "userId" = $1 AND "clientId" = $2 AND revoked IS NULL`,
      [req.authenticatedUserId, clientId]
    );
    await client.query(
      `UPDATE "oauthRefreshToken" SET revoked = NOW()
       WHERE "userId" = $1 AND "clientId" = $2 AND revoked IS NULL`,
      [req.authenticatedUserId, clientId]
    );
    await client.query(
      'DELETE FROM "oauthConsent" WHERE "clientId" = $1 AND "userId" = $2',
      [clientId, req.authenticatedUserId]
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
