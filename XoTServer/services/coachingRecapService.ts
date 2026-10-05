import {
  coachingRecapSchema,
  coachingRecapListSchema,
  type CoachingRecapRow,
} from '@workspace/shared';
import {
  coachingTransaction,
  CoachingNotFoundError,
} from '../models/coachingRepository.js';

export function mapCoachingRecap(row: CoachingRecapRow) {
  const day = (value: Date | string) =>
    typeof value === 'string'
      ? value.slice(0, 10)
      : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return coachingRecapSchema.parse({
    ...row.data,
    id: row.id,
    kind: row.kind,
    from: day(row.from_day),
    to: day(row.to_day),
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
    proposalIds: row.proposal_ids,
    evidence: row.evidence,
  });
}
export async function listCoachingRecaps(
  userId: string,
  offset = 0,
  limit = 20
) {
  return coachingTransaction(
    userId,
    async (client) => {
      const result = await client.query<CoachingRecapRow>(
        'SELECT * FROM coaching_recaps WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',
        [userId, limit + 1, offset]
      );
      const count = await client.query<{ count: number }>(
        'SELECT count(*)::integer AS count FROM coaching_recaps WHERE user_id=$1 AND read_at IS NULL',
        [userId]
      );
      return coachingRecapListSchema.parse({
        recaps: result.rows.slice(0, limit).map((row) => {
          const { evidence: _evidence, ...recap } = mapCoachingRecap(row);
          return recap;
        }),
        nextOffset: result.rows.length > limit ? offset + limit : null,
        unreadCount: count.rows[0].count,
      });
    },
    true
  );
}
export async function getCoachingRecap(userId: string, id: string) {
  return coachingTransaction(
    userId,
    async (client) => {
      const result = await client.query<CoachingRecapRow>(
        'SELECT * FROM coaching_recaps WHERE user_id=$1 AND id=$2',
        [userId, id]
      );
      if (!result.rows[0]) throw new CoachingNotFoundError('Recap not found.');
      return mapCoachingRecap(result.rows[0]);
    },
    true
  );
}
export async function markCoachingRecapRead(userId: string, id: string) {
  return coachingTransaction(userId, async (client) => {
    const result = await client.query<CoachingRecapRow>(
      'UPDATE coaching_recaps SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND id=$2 RETURNING *',
      [userId, id]
    );
    if (!result.rows[0]) throw new CoachingNotFoundError('Recap not found.');
    return mapCoachingRecap(result.rows[0]);
  });
}
export async function deleteCoachingRecap(userId: string, id: string) {
  return coachingTransaction(userId, async (client) => {
    await client.query(
      'DELETE FROM coaching_recaps WHERE user_id=$1 AND id=$2',
      [userId, id]
    );
    return { deleted: true };
  });
}
