-- Unit-less legacy JSON keys must not be rebound just because a delegate cannot
-- read their supplement history. This returns only an existence guard; no values
-- or medication records cross the RLS boundary. Unauthorized calls fail closed.
DO $migration$
BEGIN
  IF to_regprocedure('public.has_diary_access(uuid)') IS NOT NULL THEN
CREATE OR REPLACE FUNCTION public.has_diary_access(owner_uuid uuid) RETURNS bool
LANGUAGE sql STABLE
AS $function$
  SELECT public.authenticated_user_id() = owner_uuid OR EXISTS (
    SELECT 1 FROM public.family_access fa
    WHERE fa.owner_user_id = owner_uuid
    AND fa.family_user_id = public.authenticated_user_id()
    AND fa.is_active = true
    AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
    AND (fa.access_permissions->>'can_manage_diary')::boolean = true
  );
$function$;
CREATE OR REPLACE FUNCTION public.nutrient_key_is_reserved(owner_uuid uuid, nutrient_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT CASE WHEN public.has_diary_access(owner_uuid) THEN (
    EXISTS (SELECT 1 FROM public.food_entries WHERE user_id = owner_uuid AND custom_nutrients ? nutrient_key)
    OR EXISTS (SELECT 1 FROM public.medication_entries WHERE user_id = owner_uuid AND nutrients_snapshot->'custom_nutrients' ? nutrient_key)
    OR EXISTS (SELECT 1 FROM public.medications WHERE user_id = owner_uuid AND nutrients->'custom_nutrients' ? nutrient_key)
    OR EXISTS (SELECT 1 FROM public.user_goals WHERE user_id = owner_uuid AND custom_nutrients ? nutrient_key)
    OR EXISTS (SELECT 1 FROM public.goal_presets WHERE user_id = owner_uuid AND custom_nutrients ? nutrient_key)
    OR EXISTS (SELECT 1 FROM public.food_variants v JOIN public.foods f ON f.id = v.food_id WHERE f.user_id = owner_uuid AND v.custom_nutrients ? nutrient_key)
  ) ELSE true END;
$$;
  END IF;
END;
$migration$;
