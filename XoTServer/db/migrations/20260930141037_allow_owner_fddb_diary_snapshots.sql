-- Existing installations already have the identity helper. Fresh installs
-- receive this policy from rls_policies.sql immediately after migrations.
DO $$
BEGIN
  IF to_regprocedure('public.authenticated_user_id()') IS NOT NULL THEN
    -- FDDB restores historical nutrition snapshots without creating library foods.
    -- This exception is owner-only; ordinary linked diary writes keep their policy.
    CREATE POLICY food_entries_fddb_snapshot_insert_policy
    ON public.food_entries FOR INSERT TO PUBLIC
    WITH CHECK (
      user_id = authenticated_user_id()
      AND source = 'fddb'
      AND source_id ~ '^fddb:[0-9a-f]{64}$'
      AND food_id IS NULL AND meal_id IS NULL
      AND food_name IS NOT NULL AND btrim(food_name) <> ''
      AND quantity > 0 AND serving_size > 0
      AND calories >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0
      AND EXISTS (
        SELECT 1 FROM public.meal_types mt
        WHERE mt.id = food_entries.meal_type_id
          AND mt.user_id = authenticated_user_id()
      )
    );
  END IF;
END;
$$;
