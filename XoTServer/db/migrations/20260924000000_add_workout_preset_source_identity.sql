-- Keep an imported saved routine distinct from a completed workout or a
-- locally created preset that happens to have the same title.
ALTER TABLE public.workout_presets
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_presets_user_source_identity
  ON public.workout_presets (user_id, source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- A completed workout is a diary session. Its source ID permits two sessions
-- with the same title on one day while keeping repeated syncs idempotent.
ALTER TABLE public.exercise_preset_entries
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_preset_entries_user_source_identity
  ON public.exercise_preset_entries (user_id, source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;
