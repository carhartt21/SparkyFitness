-- Offline favorite/quick entries carry a complete logging-time nutrient
-- snapshot. The existing insert policies require food_id and therefore reject
-- these standalone rows. Permit only the authenticated diary owner to insert
-- one through the stable operation-ID contract; all other policies remain.
DROP POLICY IF EXISTS food_entries_offline_snapshot_insert_policy
  ON public.food_entries;
CREATE POLICY food_entries_offline_snapshot_insert_policy
  ON public.food_entries FOR INSERT TO PUBLIC
  WITH CHECK (
    user_id = public.authenticated_user_id()
    AND client_operation_id IS NOT NULL
    AND food_id IS NULL
    AND meal_id IS NULL
    AND food_name IS NOT NULL
    AND btrim(food_name) <> ''
    AND serving_size > 0
    AND calories >= 0
  );
