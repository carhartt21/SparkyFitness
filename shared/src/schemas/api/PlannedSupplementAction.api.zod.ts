import { z } from "zod";

/** A reminder response for one scheduled supplement dose on one local day. */
export const plannedSupplementActionBodySchema = z.strictObject({
  client_operation_id: z.uuid(),
  medication_id: z.uuid(),
  schedule_id: z.uuid(),
  entry_date: z.iso.date(),
  status: z.enum(["taken", "skipped"]),
  occurred_at: z.iso.datetime({ offset: true }),
});

export const plannedSupplementActionResultSchema = z.strictObject({
  entry: z
    .object({
      id: z.uuid(),
      medication_id: z.uuid().nullable(),
      schedule_id: z.uuid().nullable(),
      entry_date: z.iso.date(),
      status: z.enum(["taken", "skipped"]),
    })
    .passthrough()
    .nullable(),
  replayed: z.boolean(),
});

export type PlannedSupplementActionBody = z.infer<
  typeof plannedSupplementActionBodySchema
>;
export type PlannedSupplementActionResult = z.infer<
  typeof plannedSupplementActionResultSchema
>;
