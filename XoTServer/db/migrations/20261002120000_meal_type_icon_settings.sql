-- Existing per-account diary settings retain their RLS policies. No system
-- meal IDs, historical entries or another account's preferences are rewritten.
ALTER TABLE public.user_meal_visibilities
  ADD COLUMN IF NOT EXISTS icon_key text;
ALTER TABLE public.user_meal_visibilities
  ADD CONSTRAINT user_meal_visibilities_icon_key_check
  CHECK (icon_key IS NULL OR icon_key IN (
    'meal-breakfast', 'meal-lunch', 'meal-dinner', 'meal-snack', 'food', 'water', 'meal'
  ));
