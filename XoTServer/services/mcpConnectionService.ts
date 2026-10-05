import { coachingConnectionsSchema } from '@workspace/shared';
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

/** Auth metadata is owner-filtered here; OAuth tables are managed by Better Auth. */
export async function listMcpConnections(userId: string) {
  const client: PoolClient = await getSystemClient();
  try {
    const result = await client.query<{
      id: string;
      name: string;
      client_id: string;
      scopes: string[];
      created_at: Date;
    }>(
      `SELECT c.id,
       COALESCE(NULLIF(o.name,''),o."clientId") AS name,c."clientId" AS client_id,c.scopes,c."createdAt" AS created_at FROM "oauthConsent" c JOIN "oauthClient" o ON o."clientId"=c."clientId" WHERE c."userId"=$1 AND c.scopes ? 'mcp:read' AND c.scopes ? 'mcp:propose' AND COALESCE(o.disabled,FALSE)=FALSE ORDER BY c."createdAt" DESC`,
      [userId]
    );
    return coachingConnectionsSchema.parse({
      connections: result.rows.map((row) => ({
        ...row,
        created_at: row.created_at.toISOString(),
      })),
    });
  } finally {
    client.release();
  }
}
