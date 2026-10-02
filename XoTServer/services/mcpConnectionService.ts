import type { PoolClient } from 'pg';
import { getSystemClient } from '../db/poolManager.js';

/** JWT signatures alone cannot reflect a revoked OAuth consent. */
export async function hasActiveMcpConsent(
  userId: string,
  clientId: string,
  requiredScope = 'mcp:read'
): Promise<boolean> {
  const client: PoolClient = await getSystemClient();
  try {
    const result = await client.query(
      `SELECT 1 FROM "oauthConsent" c
       JOIN "oauthClient" o ON o."clientId" = c."clientId"
       WHERE c."userId" = $1 AND c."clientId" = $2
         AND c.scopes ? $3 AND COALESCE(o.disabled, FALSE) = FALSE
       LIMIT 1`,
      [userId, clientId, requiredScope]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    client.release();
  }
}
