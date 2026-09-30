-- Keep dated schedule snapshots and the original assignment identity after
-- an assignment or template is edited or deleted. Do not backdate existing
-- plans: their historical schedule cannot be reconstructed reliably.
CREATE TABLE public.workout_plan_template_versions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    plan_name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL,
    assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT workout_plan_version_assignments_array CHECK (jsonb_typeof(assignments) = 'array')
);

CREATE INDEX workout_plan_versions_user_template_day_idx
    ON public.workout_plan_template_versions (user_id, template_id, effective_from DESC, id DESC);

COMMENT ON TABLE public.workout_plan_template_versions IS
    'Immutable dated workout-plan snapshots for historical adherence reviews. template_id is intentionally not a foreign key, so history survives template deletion.';

ALTER TABLE public.exercise_entries
    ADD COLUMN workout_plan_origin_assignment_id INTEGER;

UPDATE public.exercise_entries
SET workout_plan_origin_assignment_id = workout_plan_assignment_id
WHERE workout_plan_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.remember_workout_plan_assignment_origin()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.workout_plan_origin_assignment_id := NEW.workout_plan_assignment_id;
    ELSE
        NEW.workout_plan_origin_assignment_id := COALESCE(
            OLD.workout_plan_origin_assignment_id,
            NEW.workout_plan_assignment_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER remember_workout_plan_assignment_origin
BEFORE INSERT OR UPDATE ON public.exercise_entries
FOR EACH ROW EXECUTE FUNCTION public.remember_workout_plan_assignment_origin();

CREATE INDEX exercise_entries_plan_origin_day_idx
    ON public.exercise_entries (user_id, workout_plan_origin_assignment_id, entry_date)
    WHERE workout_plan_origin_assignment_id IS NOT NULL;

COMMENT ON COLUMN public.exercise_entries.workout_plan_origin_assignment_id IS
    'Original plan assignment ID retained when the live foreign key is cleared by plan edits or deletion.';

-- Existing plans receive a baseline on the owner's current local day. The
-- review excludes the current day, so this baseline is used only for future
-- completed days; earlier reviews never infer a historical schedule. An edit
-- on migration day has a higher version ID and correctly supersedes it.
INSERT INTO public.workout_plan_template_versions
    (user_id, template_id, effective_from, plan_name, start_date, end_date, is_active, assignments)
SELECT t.user_id, t.id,
       (NOW() AT TIME ZONE COALESCE(zone.name, 'UTC'))::date,
       t.plan_name, t.start_date, t.end_date,
       COALESCE(t.is_active, false),
       COALESCE((
           SELECT jsonb_agg(
               jsonb_build_object(
                   'id', a.id,
                   'dayOfWeek', a.day_of_week,
                   'workoutPresetId', a.workout_preset_id,
                   'exerciseId', a.exercise_id,
                   'sortOrder', a.sort_order,
                   'sets', COALESCE((
                       SELECT jsonb_agg(to_jsonb(s) ORDER BY s.set_number, s.id)
                       FROM public.workout_plan_assignment_sets s
                       WHERE s.assignment_id = a.id
                   ), '[]'::jsonb)
               ) ORDER BY a.day_of_week, a.sort_order, a.id
           )
           FROM public.workout_plan_template_assignments a
           WHERE a.template_id = t.id
       ), '[]'::jsonb)
FROM public.workout_plan_templates t
LEFT JOIN public.user_preferences pref ON pref.user_id = t.user_id
LEFT JOIN pg_catalog.pg_timezone_names zone ON zone.name = pref.timezone;
