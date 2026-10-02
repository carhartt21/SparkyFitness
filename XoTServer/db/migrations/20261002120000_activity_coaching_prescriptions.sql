-- Preserve whole-activity metadata when capturing the shared prescription.
-- Forward-only correction: existing dated versions remain immutable.
CREATE OR REPLACE FUNCTION public.workout_plan_assignments_snapshot(plan_id INTEGER)
RETURNS JSONB LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',a.id,'dayOfWeek',a.day_of_week,'workoutPresetId',a.workout_preset_id,
    'exerciseId',a.exercise_id,'sortOrder',a.sort_order,
    'label',COALESCE(NULLIF(a.session_name,''),p.name,e.name,a.activity_type,'Activity'),
    'activityType',a.activity_type,'sessionName',a.session_name,
    'plannedDurationMinutes',a.planned_duration_minutes,'plannedDistanceKm',a.planned_distance_km,
    'plannedTime',a.planned_time,'isOptional',a.is_optional,
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

INSERT INTO public.workout_plan_template_versions
  (user_id,template_id,effective_from,plan_name,start_date,end_date,is_active,assignments)
SELECT t.user_id,t.id,(NOW() AT TIME ZONE COALESCE(zone.name,'UTC'))::date,
  t.plan_name,t.start_date,t.end_date,COALESCE(t.is_active,false),public.workout_plan_assignments_snapshot(t.id)
FROM public.workout_plan_templates t
LEFT JOIN public.user_preferences pref ON pref.user_id=t.user_id
LEFT JOIN pg_catalog.pg_timezone_names zone ON zone.name=pref.timezone;
