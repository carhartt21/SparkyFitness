-- Repair denormalized lookup columns from the authoritative stored snapshots.
-- Unique/FK conflicts abort the migration for inspection; no sessions/plans are discarded.
UPDATE mobility_schedules SET routine_id=(data->>'routineId')::uuid
  WHERE routine_id IS DISTINCT FROM (data->>'routineId')::uuid;
UPDATE mobility_plans SET schedule_id=(data->>'scheduleId')::uuid,local_day=(data->>'day')::date
  WHERE schedule_id IS DISTINCT FROM (data->>'scheduleId')::uuid OR local_day IS DISTINCT FROM (data->>'day')::date;
UPDATE mobility_sessions SET plan_id=(data->>'planId')::uuid
  WHERE plan_id IS DISTINCT FROM (data->>'planId')::uuid;
ALTER TABLE mobility_schedules ADD CONSTRAINT mobility_schedules_snapshot_index_check
  CHECK (routine_id=(data->>'routineId')::uuid);
ALTER TABLE mobility_plans ADD CONSTRAINT mobility_plans_snapshot_index_check
  CHECK (schedule_id IS NOT DISTINCT FROM (data->>'scheduleId')::uuid AND local_day=(data->>'day')::date);
ALTER TABLE mobility_sessions ADD CONSTRAINT mobility_sessions_snapshot_index_check
  CHECK (plan_id IS NOT DISTINCT FROM (data->>'planId')::uuid);
