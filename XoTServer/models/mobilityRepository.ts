import type { PoolClient } from 'pg';
import type { MobilityProvenance } from '@workspace/shared';
export type MobilityTable =
  | 'mobility_routines'
  | 'mobility_schedules'
  | 'mobility_plans'
  | 'mobility_sessions';
export interface MobilityRow {
  id: string;
  data: unknown;
  revision: number;
  deleted: boolean;
  provenance?: MobilityProvenance;
}
export async function mobilityRows(
  client: PoolClient,
  userId: string,
  table: MobilityTable
): Promise<MobilityRow[]> {
  const result = await client.query<MobilityRow>(
    `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY updated_at, id`,
    [userId]
  );
  return result.rows;
}
export async function mobilityRow(
  client: PoolClient,
  userId: string,
  table: MobilityTable,
  id: string
): Promise<MobilityRow | undefined> {
  const result = await client.query<MobilityRow>(
    `SELECT * FROM ${table} WHERE user_id = $1 AND id = $2 FOR UPDATE`,
    [userId, id]
  );
  return result.rows[0];
}
