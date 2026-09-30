-- Completion adds nutrient-bearing food rows to an existing photo occurrence.
-- The capture ID and timestamps remain stable; food nutrition stays snapshotted.
ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS nutrition_capture_id uuid NULL
    REFERENCES public.nutrition_captures(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_food_entries_nutrition_capture_id
  ON public.food_entries (nutrition_capture_id)
  WHERE nutrition_capture_id IS NOT NULL;

-- Initial completion logs one reviewed food snapshot. A later composite-meal
-- extension can replace this index with a multi-item membership table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_one_per_nutrition_capture
  ON public.food_entries (nutrition_capture_id)
  WHERE nutrition_capture_id IS NOT NULL;

-- A foreign key alone does not enforce owner matching. This invoker-rights
-- trigger prevents a generic food-entry request from linking another user's
-- private capture even if the caller knows its UUID.
CREATE OR REPLACE FUNCTION public.check_food_entry_capture_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nutrition_capture_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.nutrition_captures c
    WHERE c.id = NEW.nutrition_capture_id
      AND c.user_id = NEW.user_id
      AND c.user_id = public.authenticated_user_id()
  ) THEN
    RAISE EXCEPTION 'Capture does not belong to this diary owner' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_food_entry_capture_owner ON public.food_entries;
CREATE TRIGGER check_food_entry_capture_owner
  BEFORE INSERT OR UPDATE OF nutrition_capture_id, user_id
  ON public.food_entries FOR EACH ROW
  EXECUTE FUNCTION public.check_food_entry_capture_owner();
