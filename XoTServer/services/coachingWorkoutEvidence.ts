import {
  coachingEvidenceRowSchema,
  type ActivityOccurrence,
  type CoachingEvidenceRow,
} from '@workspace/shared';

/** Share the recorded-prescription projection, never substitute attendance. */
export function coachingWorkoutEvidence(
  occurrences: readonly ActivityOccurrence[],
  today: string
): CoachingEvidenceRow[] {
  const groups = new Map<string, ActivityOccurrence[]>();
  for (const occurrence of occurrences) {
    if (occurrence.source !== 'workout') continue;
    const key = `${occurrence.source_id}:${occurrence.date}`;
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  const evidence: CoachingEvidenceRow[] = [];
  for (const [key, rows] of groups) {
    const day = rows[0].date;
    const eligible = rows.filter(
      (row) =>
        row.state !== 'excluded' &&
        !row.optional &&
        row.reason !== 'prescription_unknown'
    );
    const completed = eligible.filter((row) => row.state === 'complete').length;
    const unknown = rows.filter(
      (row) =>
        row.state !== 'excluded' &&
        !row.optional &&
        row.reason === 'prescription_unknown'
    ).length;
    evidence.push(
      coachingEvidenceRowSchema.parse({
        id: `workout_adherence:${key}`,
        domain: 'activity',
        kind: 'workout_adherence',
        day,
        source: 'server',
        observedAt: null,
        confirmation:
          day < today && eligible.length > 0 ? 'confirmed' : 'unknown',
        value: {
          templateId: Number(rows[0].source_id),
          completionBasis: 'saved_prescription',
          ratio:
            day < today && eligible.length > 0
              ? completed / eligible.length
              : null,
          eligible: day < today ? eligible.length : 0,
          completed: day < today ? completed : 0,
          started: rows.filter((row) => row.state === 'started').length,
          excluded: rows.filter(
            (row) => row.state === 'excluded' || row.optional
          ).length,
          unknown,
          unit: 'ratio',
          occurrences: rows.map((row) => ({
            id: row.id,
            state: row.state,
            reason: row.reason,
            optional: row.optional ?? false,
            evidenceIds: row.evidence_ids,
          })),
          limitation:
            'Only elapsed scheduled days enter outcomes. Completion requires the saved prescription or an explicit owner link to a confirmed record. Started sessions are incomplete; skipped and optional sessions are excluded. Unknown prescriptions are missing evidence, never zero.',
        },
      })
    );
  }
  return evidence;
}
