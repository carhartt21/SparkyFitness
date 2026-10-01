ALTER TABLE public.workout_plan_template_assignments DROP CONSTRAINT chk_workout_assignment_type;

ALTER TABLE public.workout_plan_template_assignments
    ADD COLUMN activity_type VARCHAR(32),
    ADD COLUMN planned_duration_minutes NUMERIC,
    ADD COLUMN planned_distance_km NUMERIC,
    ADD COLUMN planned_time TIME,
    ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT workout_plan_activity_type CHECK (activity_type IN
      ('running','strength','cycling','walking','hiking','swimming','rowing','soccer','yoga','other','rest')),
    ADD CONSTRAINT workout_plan_activity_identity CHECK
      (num_nonnulls(activity_type, exercise_id, workout_preset_id) = 1),
    ADD CONSTRAINT workout_plan_activity_duration CHECK
      (planned_duration_minutes > 0 AND planned_duration_minutes <= 1440),
    ADD CONSTRAINT workout_plan_activity_distance CHECK
      (planned_distance_km > 0 AND planned_distance_km <= 1000),
    ADD CONSTRAINT workout_plan_rest_targets CHECK
      (activity_type IS DISTINCT FROM 'rest' OR (planned_duration_minutes IS NULL AND planned_distance_km IS NULL));

COMMENT ON COLUMN public.workout_plan_template_assignments.activity_type IS
    'Whole planned training type, distinct from completed diary entries; rest is not a completion task.';
COMMENT ON COLUMN public.workout_plan_template_assignments.planned_time IS
    'Optional account-local session time, not a UTC instant.';
