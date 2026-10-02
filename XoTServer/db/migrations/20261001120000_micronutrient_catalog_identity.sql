-- Catalog identity is independent of user display names. Retained definitions
-- reserve their name and unit when history is kept. Definition RLS is retained; native snapshot insertion is scoped below.
ALTER TABLE public.user_custom_nutrients
  ADD COLUMN catalog_id text,
  ADD COLUMN archived boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX user_custom_nutrients_catalog_identity
  ON public.user_custom_nutrients (user_id, catalog_id)
  WHERE catalog_id IS NOT NULL;
-- Backfill is deliberately deferred: an alias alone cannot prove identity or unit.

DO $$
BEGIN
  IF to_regprocedure('public.has_diary_access(uuid)') IS NOT NULL THEN
-- Native diary delegates write standalone snapshots without editing the owner's library.
CREATE POLICY food_entries_native_snapshot_insert_policy
ON public.food_entries FOR INSERT TO PUBLIC
WITH CHECK (
  has_diary_access(user_id)
  AND source IN ('healthkit', 'health_connect')
  AND source_id IS NOT NULL AND length(source_id) BETWEEN 1 AND 512
  AND food_id IS NULL AND meal_id IS NULL
  AND food_name IS NOT NULL AND btrim(food_name) <> ''
  AND quantity = 1 AND serving_size = 1
  AND EXISTS (SELECT 1 FROM public.meal_types mt WHERE mt.id = food_entries.meal_type_id AND (mt.user_id = food_entries.user_id OR mt.user_id IS NULL))
);
  END IF;
END;
$$;
