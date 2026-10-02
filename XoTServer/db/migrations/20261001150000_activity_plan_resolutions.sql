-- Planning resolutions never create or change diary activity or calories.
CREATE TABLE public.activity_plan_resolutions (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  occurrence_id TEXT NOT NULL,
  local_day DATE NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('skip', 'link', 'undo')),
  record_id UUID,
  entry_id UUID REFERENCES public.exercise_entries(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, occurrence_id),
  CHECK ((action = 'link' AND record_id IS NOT NULL) OR
         (action <> 'link' AND record_id IS NULL AND entry_id IS NULL))
);
CREATE UNIQUE INDEX activity_plan_resolution_record_idx
  ON public.activity_plan_resolutions(user_id, record_id)
  WHERE record_id IS NOT NULL AND entry_id IS NOT NULL;
CREATE INDEX activity_plan_resolution_day_idx
  ON public.activity_plan_resolutions(user_id, local_day);
ALTER TABLE public.activity_plan_resolutions ENABLE ROW LEVEL SECURITY;

-- Older versions point to retired auth.users. Compatible with the coaching fix.
DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid='public.workout_plan_template_versions'::regclass
      AND c.contype='f' AND c.confrelid <> 'public."user"'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.workout_plan_template_versions DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE
    conrelid='public.workout_plan_template_versions'::regclass AND contype='f'
    AND confrelid='public."user"'::regclass) THEN
    ALTER TABLE public.workout_plan_template_versions ADD CONSTRAINT
      workout_plan_template_versions_owner_fkey FOREIGN KEY(user_id)
      REFERENCES public."user"(id) ON DELETE CASCADE;
  END IF;
END $$;

-- One snapshot implementation serves baseline migration and future plan writes.
-- Invoker permissions and table RLS are retained; no security definer privileges.
CREATE OR REPLACE FUNCTION public.workout_plan_assignments_snapshot(plan_id INTEGER)
RETURNS JSONB LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',a.id,'dayOfWeek',a.day_of_week,'workoutPresetId',a.workout_preset_id,
    'exerciseId',a.exercise_id,'sortOrder',a.sort_order,
    'label',COALESCE(p.name,e.name,'Activity'),
    'sets',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.set_number,s.id)
      FROM public.workout_plan_assignment_sets s WHERE s.assignment_id=a.id),'[]'::jsonb),
    'exercises',CASE WHEN a.exercise_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object(
      'exerciseId',a.exercise_id,'name',e.name,
      'expectedSets',GREATEST(1,(SELECT COUNT(*) FROM public.workout_plan_assignment_sets s WHERE s.assignment_id=a.id)),
      'sets',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.set_number,s.id)
        FROM public.workout_plan_assignment_sets s WHERE s.assignment_id=a.id),'[]'::jsonb)))
      ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'exerciseId',pe.exercise_id,'name',ex.name,
        'expectedSets',GREATEST(1,(SELECT COUNT(*) FROM public.workout_preset_exercise_sets s WHERE s.workout_preset_exercise_id=pe.id)),
        'sets',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.set_number,s.id)
          FROM public.workout_preset_exercise_sets s WHERE s.workout_preset_exercise_id=pe.id),'[]'::jsonb)
      ) ORDER BY pe.id) FROM public.workout_preset_exercises pe
        JOIN public.exercises ex ON ex.id=pe.exercise_id WHERE pe.workout_preset_id=a.workout_preset_id),'[]'::jsonb) END
  ) ORDER BY a.day_of_week,a.sort_order,a.id),'[]'::jsonb)
  FROM public.workout_plan_template_assignments a
  LEFT JOIN public.workout_presets p ON p.id=a.workout_preset_id
  LEFT JOIN public.exercises e ON e.id=a.exercise_id
  WHERE a.template_id=plan_id;
$$;
-- New metadata starts today; historical prescriptions are never guessed.
INSERT INTO public.workout_plan_template_versions
  (user_id,template_id,effective_from,plan_name,start_date,end_date,is_active,assignments)
SELECT t.user_id,t.id,(NOW() AT TIME ZONE COALESCE(zone.name,'UTC'))::date,
  t.plan_name,t.start_date,t.end_date,COALESCE(t.is_active,false),public.workout_plan_assignments_snapshot(t.id)
FROM public.workout_plan_templates t
LEFT JOIN public.user_preferences pref ON pref.user_id=t.user_id
LEFT JOIN pg_catalog.pg_timezone_names zone ON zone.name=pref.timezone;
