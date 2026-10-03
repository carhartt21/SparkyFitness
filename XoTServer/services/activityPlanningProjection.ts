import {
  ACTIVITY_SPORTS,
  addDays,
  dayOfWeek,
  classifyActivitySport,
  type ActivityOccurrence,
  type ActivityPlanningResponse,
  type ActivityRecord,
} from '@workspace/shared';
import type {
  ActivityPlanningData,
  PlanningEntry,
  PlanVersion,
} from '../models/activityPlanningRepository.js';

const recordedActivity = (row: PlanningEntry) =>
  row.source !== 'Workout Plan' &&
  ((row.duration_minutes ?? 0) > 0 || (row.distance ?? 0) > 0);

/** Pure projection: reads never generate plans, completion or diary rows. */
export function projectActivityPlanning(
  data: ActivityPlanningData,
  from: string,
  to: string,
  timezone: string,
  today: string
): ActivityPlanningResponse {
  const occurrences: ActivityOccurrence[] = [];
  const automaticTargets = new Map<
    string,
    { duration: number | null; distance: number | null; capturedAt: string }
  >();
  const grouped = new Map<string, typeof data.entries>();
  for (const entry of data.entries) {
    const rows = grouped.get(entry.record_id) ?? [];
    rows.push(entry);
    grouped.set(entry.record_id, rows);
  }
  const records: ActivityRecord[] = [...grouped].map(([id, rows]) => ({
    id,
    date: rows[0].entry_date,
    label: rows[0].session_name,
    activity_type: classifyActivitySport({
      exerciseName: rows[0].exercise_name,
      category: rows[0].category,
      notes: rows[0].notes,
      providerName: rows[0].provider_name,
      detailData: rows[0].detail_data,
    }).sport,
    entry_ids: rows.map((row) => row.id),
    origin_assignment_ids: [
      ...new Set(
        rows.flatMap((row) => (row.origin_id === null ? [] : [row.origin_id]))
      ),
    ],
    confirmed:
      rows[0].entry_date <= today &&
      rows.some((row) => row.completed_count > 0 || recordedActivity(row)),
    linked_occurrence_id:
      data.resolutions.find(
        (row) =>
          row.action === 'link' &&
          row.entry_id &&
          row.record_id === id &&
          rows.some((e) => e.id === row.entry_id)
      )?.occurrence_id ?? null,
  }));
  const reserved = new Set(
    records
      .filter(
        (record) =>
          record.origin_assignment_ids.length > 0 || record.linked_occurrence_id
      )
      .map((record) => record.id)
  );
  const automaticEvidence = (
    entry: PlanningEntry,
    date: string,
    sport: ActivityOccurrence['activity_type'],
    capturedAt: string
  ) => {
    const record = records.find((row) => row.id === entry.record_id)!;
    return (
      date <= today &&
      sport !== 'other' &&
      record.confirmed &&
      !reserved.has(record.id) &&
      record.date === date &&
      record.activity_type === sport &&
      grouped.get(record.id)!.length === 1 &&
      recordedActivity(entry) &&
      entry.recorded_at !== null &&
      new Date(entry.recorded_at).getTime() >= new Date(capturedAt).getTime()
    );
  };
  const versions = new Map<number, typeof data.versions>();
  for (const version of data.versions) {
    const list = versions.get(version.template_id) ?? [];
    list.push(version);
    versions.set(version.template_id, list);
  }
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const [templateId, history] of versions) {
      const effective = history.filter((row) => row.effective_from <= date);
      const current = effective.at(-1);
      const due = (version: (typeof history)[number]) =>
        version.is_active &&
        (!version.start_date || version.start_date <= date) &&
        (!version.end_date || version.end_date >= date);
      // A prescription is pinned at the first confirmed set or owner decision.
      // Captures from before that instant describe what was actually scheduled;
      // later edits retaining the same assignment ID cannot rewrite it.
      const onDay = effective.filter(
        (row, index) =>
          !effective[index + 1] || effective[index + 1].effective_from >= date
      );
      const retained = new Map<
        number,
        {
          version: (typeof history)[number];
          assignment: (typeof history)[number]['assignments'][number];
        }
      >();
      const assignmentIds = new Set(
        onDay.flatMap((version) =>
          version.assignments
            .filter((row) => row.dayOfWeek === dayOfWeek(date))
            .map((row) => row.id)
        )
      );
      for (const assignmentId of assignmentIds) {
        const key = `workout:${templateId}:${assignmentId}:${date}`;
        const decision = data.resolutions.find(
          (row) => row.occurrence_id === key && row.action !== 'undo'
        );
        const firstSet =
          date <= today
            ? data.entries
                .filter(
                  (row) =>
                    row.entry_date === date &&
                    ((row.origin_id === assignmentId &&
                      (row.completed_count > 0 || recordedActivity(row))) ||
                      onDay.some((version) => {
                        const assignment = version.assignments.find(
                          (item) =>
                            item.id === assignmentId &&
                            item.dayOfWeek === dayOfWeek(date)
                        );
                        return (
                          due(version) &&
                          assignment &&
                          assignment.activityType &&
                          !assignment.exerciseId &&
                          !assignment.workoutPresetId &&
                          automaticEvidence(
                            row,
                            date,
                            classifyActivitySport({
                              exerciseName: assignment.activityType,
                            }).sport,
                            version.captured_at
                          )
                        );
                      }))
                )
                .map((row) =>
                  row.origin_id === assignmentId
                    ? (row.first_confirmed_at ?? row.recorded_at)
                    : row.recorded_at
                )
                .filter((at): at is string => at !== null)
                .sort()[0]
            : undefined;
        const event = [decision?.updated_at, firstSet]
          .filter((at): at is string => at !== undefined)
          .sort()[0];
        if (!event) continue;
        const source = [...onDay]
          .reverse()
          .find(
            (version) =>
              due(version) &&
              version.captured_at <= event &&
              version.assignments.some(
                (row) =>
                  row.id === assignmentId && row.dayOfWeek === dayOfWeek(date)
              )
          );
        const assignment = source?.assignments.find(
          (row) => row.id === assignmentId
        );
        if (source && assignment)
          retained.set(assignmentId, { version: source, assignment });
      }
      const currentAssignments =
        current && due(current)
          ? current.assignments.filter(
              (row) => row.dayOfWeek === dayOfWeek(date)
            )
          : [];
      // For replaced IDs, consume only one matching activity per retained row.
      // Position alone must not suppress an unrelated new weekday activity.
      const replaced = new Set<number>();
      for (const { assignment } of retained.values()) {
        if (currentAssignments.some((row) => row.id === assignment.id))
          continue;
        const replacement = currentAssignments.find(
          (row) =>
            !replaced.has(row.id) &&
            !retained.has(row.id) &&
            ((assignment.exerciseId !== null &&
              row.exerciseId === assignment.exerciseId) ||
              (assignment.workoutPresetId !== null &&
                row.workoutPresetId === assignment.workoutPresetId) ||
              (assignment.activityType &&
                !assignment.exerciseId &&
                !assignment.workoutPresetId &&
                !row.exerciseId &&
                !row.workoutPresetId &&
                row.activityType === assignment.activityType))
        );
        if (replacement) replaced.add(replacement.id);
      }
      const assignments = [...retained.values()];
      if (current)
        for (const assignment of currentAssignments) {
          if (!retained.has(assignment.id) && !replaced.has(assignment.id))
            assignments.push({ version: current, assignment });
        }
      for (const { assignment, version } of assignments) {
        if (assignment.activityType === 'rest') continue;
        const id = `workout:${templateId}:${assignment.id}:${date}`;
        const resolution = data.resolutions.find(
          (row) => row.occurrence_id === id
        );
        const evidence = data.entries.filter(
          (row) => row.entry_date === date && row.origin_id === assignment.id
        );
        // One saved session must contain every prescribed exercise; duplicate logs
        // and excess sets in a single exercise cannot complete another exercise.
        const prescribed = assignment.exercises;
        const expectedSets =
          prescribed?.reduce((sum, e) => sum + e.expectedSets, 0) ?? null;
        const confirmedEvidence = date <= today ? evidence : [];
        const completedSets = confirmedEvidence.reduce(
          (sum, row) => sum + row.completed_count,
          0
        );
        const recordIds = [
          ...new Set(confirmedEvidence.map((row) => row.record_id)),
        ];
        const setsComplete = Boolean(
          prescribed?.length &&
          recordIds.some((recordId) =>
            (() => {
              const available = confirmedEvidence.filter(
                (row) => row.record_id === recordId
              );
              return [...prescribed]
                .sort((a, b) => b.expectedSets - a.expectedSets)
                .every((exercise) => {
                  const index = available.findIndex(
                    (row) =>
                      (row.exercise_id === exercise.exerciseId ||
                        (row.exercise_id === null &&
                          row.exercise_name === exercise.name)) &&
                      row.completed_count >= exercise.expectedSets
                  );
                  if (index < 0) return false;
                  available.splice(index, 1);
                  return true;
                });
            })()
          )
        );
        const wholeActivity = Boolean(
          assignment.activityType &&
          !assignment.exerciseId &&
          !assignment.workoutPresetId
        );
        const actualActivity = confirmedEvidence.filter(recordedActivity);
        const activityComplete =
          wholeActivity &&
          actualActivity.some(
            (row) =>
              (assignment.plannedDurationMinutes === null ||
                assignment.plannedDurationMinutes === undefined ||
                (row.duration_minutes !== null &&
                  row.duration_minutes !== undefined &&
                  row.duration_minutes >= assignment.plannedDurationMinutes)) &&
              (assignment.plannedDistanceKm === null ||
                assignment.plannedDistanceKm === undefined ||
                (row.distance !== null &&
                  row.distance !== undefined &&
                  row.distance >= assignment.plannedDistanceKm))
          );
        const complete = wholeActivity ? activityComplete : setsComplete;
        const started =
          completedSets > 0 || (wholeActivity && actualActivity.length > 0);
        const linked =
          resolution?.action === 'link' &&
          resolution.entry_id !== null &&
          records.find(
            (row) =>
              row.id === resolution.record_id &&
              row.entry_ids.includes(resolution.entry_id!) &&
              row.date === date &&
              row.confirmed
          );
        const skipped = resolution?.action === 'skip';
        if (
          wholeActivity &&
          !actualActivity.length &&
          (!resolution || resolution.action === 'undo')
        ) {
          automaticTargets.set(id, {
            duration: assignment.plannedDurationMinutes ?? null,
            distance: assignment.plannedDistanceKm ?? null,
            capturedAt: version.captured_at,
          });
        }
        occurrences.push({
          id,
          date,
          source: 'workout',
          source_id: String(templateId),
          assignment_id: assignment.id,
          revision: resolution?.revision ?? 0,
          label: assignment.label ?? version.plan_name,
          plan_label: version.plan_name,
          activity_type: ACTIVITY_SPORTS.includes(
            assignment.activityType as (typeof ACTIVITY_SPORTS)[number]
          )
            ? (assignment.activityType as (typeof ACTIVITY_SPORTS)[number])
            : classifyActivitySport({
                exerciseName: assignment.label ?? version.plan_name,
                category: sharedCategory(assignment, data.exerciseCategories),
              }).sport,
          optional: assignment.isOptional ?? false,
          state: skipped
            ? 'excluded'
            : linked || complete
              ? 'complete'
              : started
                ? 'started'
                : 'pending',
          reason: skipped
            ? 'activity_skipped'
            : linked
              ? 'owner_linked_record'
              : complete
                ? wholeActivity
                  ? 'activity_targets_recorded'
                  : 'prescribed_sets_recorded'
                : expectedSets === null && !wholeActivity
                  ? 'prescription_unknown'
                  : started
                    ? 'partial_or_unknown_prescription'
                    : resolution?.action === 'link'
                      ? 'linked_record_missing'
                      : 'not_recorded',
          recorded_at:
            skipped || linked
              ? (resolution?.updated_at ?? null)
              : complete || started
                ? (evidence
                    .map((row) => row.recorded_at)
                    .filter((at): at is string => at !== null)
                    .sort()
                    .at(-1) ?? null)
                : null,
          evidence_ids: linked
            ? linked.entry_ids
            : evidence
                .filter(
                  (row) =>
                    row.completed_count > 0 ||
                    (wholeActivity && recordedActivity(row))
                )
                .map((row) => row.id),
          expected_sets: expectedSets,
          completed_sets: completedSets,
        });
      }
    }
  }
  for (const { data: plan, revision, deleted } of data.mobilityPlans) {
    if (deleted) continue;
    const sessions = data.mobilitySessions.filter(
      (row) => !row.deleted && row.data.planId === plan.id
    );
    const completed = sessions.find(
      (row) =>
        row.data.state === 'finished' &&
        plan.routine.steps.every((step) =>
          row.data.outcomes.some(
            (outcome) =>
              outcome.stepId === step.id && outcome.result === 'completed'
          )
        )
    );
    const recorded = sessions.some((row) =>
      row.data.outcomes.some((outcome) => outcome.result === 'completed')
    );
    const excluded = plan.state === 'skipped' || plan.state === 'cancelled';
    const type = classifyActivitySport({
      exerciseName: plan.routine.name,
    }).sport;
    occurrences.push({
      id: `mobility:${plan.id}`,
      date: plan.day,
      source: 'mobility',
      source_id: plan.id,
      assignment_id: null,
      revision,
      label: plan.routine.name,
      plan_label: plan.routine.name,
      activity_type: type === 'stretching' ? 'stretching' : 'mobility',
      state: excluded
        ? 'excluded'
        : completed && plan.day <= today
          ? 'complete'
          : plan.state === 'active' || recorded || plan.state === 'completed'
            ? 'started'
            : 'pending',
      reason: excluded
        ? 'activity_skipped'
        : completed && plan.day <= today
          ? 'mobility_steps_confirmed'
          : recorded || plan.state === 'completed'
            ? 'partial_or_unknown_steps'
            : 'not_recorded',
      recorded_at: completed?.data.endedAt ?? null,
      evidence_ids: sessions.map((row) => row.data.id),
      expected_sets: null,
      completed_sets: 0,
    });
  }
  // An imported session has no plan assignment ID. Match it conservatively at
  // read time; do not create links, diary rows or energy credits. Explicitly
  // assigned/linked sessions are reserved, and one record can resolve one task.
  const candidates = occurrences
    .filter((occurrence) => automaticTargets.has(occurrence.id))
    .sort((a, b) => {
      const left = automaticTargets.get(a.id)!;
      const right = automaticTargets.get(b.id)!;
      const specificity = (target: typeof left) =>
        Number(target.duration !== null) + Number(target.distance !== null);
      return (
        specificity(right) - specificity(left) ||
        (right.distance ?? 0) - (left.distance ?? 0) ||
        (right.duration ?? 0) - (left.duration ?? 0) ||
        a.id.localeCompare(b.id)
      );
    });
  for (const occurrence of candidates) {
    if (occurrence.date > today || occurrence.activity_type === 'other')
      continue;
    const target = automaticTargets.get(occurrence.id)!;
    const eligible = records
      .flatMap((record) => {
        const evidence = grouped
          .get(record.id)!
          .filter((entry) =>
            automaticEvidence(
              entry,
              occurrence.date,
              occurrence.activity_type,
              target.capturedAt
            )
          );
        if (evidence.length !== 1) return [];
        const entry = evidence[0];
        const complete =
          (target.duration === null ||
            (entry.duration_minutes ?? -1) >= target.duration) &&
          (target.distance === null ||
            (entry.distance ?? -1) >= target.distance);
        return [{ record, entry, complete }];
      })
      .sort(
        (a, b) =>
          Number(b.complete) - Number(a.complete) ||
          a.entry.recorded_at!.localeCompare(b.entry.recorded_at!) ||
          a.record.id.localeCompare(b.record.id)
      );
    const match = eligible[0];
    if (!match) continue;
    reserved.add(match.record.id);
    occurrence.state = match.complete ? 'complete' : 'started';
    occurrence.reason = match.complete
      ? 'compatible_activity_recorded'
      : 'partial_activity_targets';
    occurrence.recorded_at = match.entry.recorded_at;
    occurrence.evidence_ids = [match.entry.id];
  }
  occurrences.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
  return {
    start_date: from,
    end_date: to,
    timezone,
    occurrences,
    records,
    summary: ACTIVITY_SPORTS.map((activity_type) => {
      const rows = occurrences.filter(
        (row) => row.activity_type === activity_type
      );
      return {
        activity_type,
        scheduled: rows.length,
        completed: rows.filter((row) => row.state === 'complete').length,
        started: rows.filter((row) => row.state === 'started').length,
        pending: rows.filter((row) => row.state === 'pending').length,
        unknown: rows.filter((row) => row.reason === 'prescription_unknown')
          .length,
        excluded: rows.filter((row) => row.state === 'excluded').length,
      };
    }).filter((row) => row.scheduled > 0),
    workout_plans: [...versions.values()]
      .map((history) => history.at(-1)!)
      .map((row) => ({
        id: row.template_id,
        plan_name: row.plan_name,
        start_date: row.start_date,
        end_date: row.end_date,
        is_active: row.is_active,
        schedule_type: row.assignments.every((a) => a.dayOfWeek === null)
          ? 'sequential'
          : 'weekly',
        assignments: row.assignments,
      })),
    note: 'Counts describe scheduled activities, not all exercise volume or a health score. Classification from names is inferred. Only confirmed records resolve tasks; unsynced phone/Watch activity is absent. Earlier prescriptions without snapshots are unknown. Sequential plans are not dated weekly tasks.',
  };
}

/**
 * The category every planned exercise of an assignment shares, or null when
 * they differ or are unknown — a mixed preset falls back to its name.
 */
function sharedCategory(
  assignment: PlanVersion['assignments'][number],
  categories: Record<string, string | null> | undefined
): string | null {
  const ids = [
    ...(assignment.exerciseId ? [assignment.exerciseId] : []),
    ...(assignment.exercises ?? []).map((exercise) => exercise.exerciseId),
  ];
  const found = [...new Set(ids)].map((id) =>
    categories?.[id]?.trim().toLowerCase()
  );
  if (found.length === 0 || found.some((category) => !category)) return null;
  return new Set(found).size === 1 ? (found[0] ?? null) : null;
}
