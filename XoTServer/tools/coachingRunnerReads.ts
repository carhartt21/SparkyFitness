import { z } from 'zod';
import {
  coachingContextSchema,
  coachingSnapshotPageSchema,
} from '@workspace/shared';

const eventSchema = z.object({
  type: z.literal('item.completed'),
  item: z.object({
    type: z.literal('mcp_tool_call'),
    server: z.literal('xot'),
    tool: z.string(),
    status: z.literal('completed'),
    error: z.null().optional(),
    arguments: z.record(z.string(), z.unknown()),
    result: z.object({
      isError: z.boolean().optional(),
      content: z.array(
        z.object({ type: z.string(), text: z.string().optional() })
      ),
      structuredContent: z.unknown().optional(),
    }),
  }),
});
const followsAllPages = (pages: Map<number, number | null>): boolean => {
  let cursor: number | null = 0;
  const visited = new Set<number>();
  while (cursor !== null) {
    if (visited.has(cursor) || !pages.has(cursor)) return false;
    visited.add(cursor);
    cursor = pages.get(cursor) ?? null;
  }
  return true;
};

/** Retain only paging cursors from CLI events, never a transcript or health data. */
export class CoachingRunReadAudit {
  private snapshot = new Map<number, number | null>();
  private proposals = new Map<number, number | null>();
  private commitments = new Map<number, number | null>();
  private events = new Map<number, number | null>();
  constructor(private readonly snapshotId: string) {}

  observe(value: unknown): void {
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success || parsed.data.item.result.isError) return;
    const { tool, arguments: args, result } = parsed.data.item;
    let body: unknown = result.structuredContent;
    try {
      body ??= JSON.parse(
        result.content.find((block) => block.type === 'text')?.text ?? 'null'
      );
    } catch {
      return;
    }
    if (tool === 'xot_get_coaching_snapshot') {
      const page = coachingSnapshotPageSchema.safeParse(body);
      if (page.success && page.data.snapshotId === this.snapshotId)
        this.snapshot.set(page.data.offset, page.data.nextOffset);
    } else if (tool === 'xot_get_coaching_context') {
      const page = coachingContextSchema.safeParse(body);
      if (!page.success) return;
      const offset = (field: string) =>
        typeof args[field] === 'number' ? args[field] : 0;
      this.proposals.set(
        offset('proposalOffset'),
        page.data.nextProposalOffset
      );
      this.commitments.set(
        offset('commitmentOffset'),
        page.data.nextCommitmentOffset
      );
      this.events.set(
        offset('eventCursor'),
        page.data.events.length < 100 ? null : page.data.nextEventCursor
      );
    }
  }

  complete(): boolean {
    return [this.snapshot, this.proposals, this.commitments, this.events].every(
      followsAllPages
    );
  }
}
