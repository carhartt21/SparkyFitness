import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { getClient } from '../db/poolManager.js';
import { canonicalJson } from '../utils/canonicalJson.js';

export class CoachingConflictError extends Error {}
export class CoachingValidationError extends Error {}
export class CoachingNotFoundError extends Error {}
export class CoachingForbiddenError extends Error {}

export const coachingFingerprint = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

/** Shared transaction boundary for approval, canonical mutations and receipts. */
export async function coachingTransaction<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>,
  readOnly = false
): Promise<T> {
  const client = await getClient(userId, userId);
  try {
    await client.query(
      readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'
    );
    if (!readOnly)
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`coaching:${userId}`]
      );
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function coachingOperation<T>(
  client: PoolClient,
  userId: string,
  operationId: string,
  request: unknown,
  schema: z.ZodType<T>,
  work: () => Promise<T>,
  agentId: string | null = null
): Promise<T> {
  const fingerprint = coachingFingerprint({ agentId, request });
  const prior = await client.query<{ request_hash: string; result: unknown }>(
    'SELECT request_hash,result FROM coaching_operations WHERE user_id=$1 AND operation_id=$2',
    [userId, operationId]
  );
  const receipt = prior.rows[0];
  if (receipt) {
    if (receipt.request_hash !== fingerprint)
      throw new CoachingConflictError(
        'This operation ID was used for a different request.'
      );
    return schema.parse(receipt.result);
  }
  const result = schema.parse(await work());
  await client.query(
    'INSERT INTO coaching_operations(user_id,operation_id,agent_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',
    [userId, operationId, agentId, fingerprint, JSON.stringify(result)]
  );
  return result;
}

export async function coachingEvent(
  client: PoolClient,
  userId: string,
  kind: string,
  data: unknown,
  proposalId: string | null = null,
  actionId: string | null = null
): Promise<void> {
  await client.query(
    'INSERT INTO coaching_events(user_id,kind,data,proposal_id,action_id) VALUES($1,$2,$3,$4,$5)',
    [userId, kind, JSON.stringify(data), proposalId, actionId]
  );
}
