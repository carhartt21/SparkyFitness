-- Exercise-level notes were dropped when presets moved to per-set rows, but
-- preset API reads and writes still use them. Restore the column without
-- changing existing preset or set data.
ALTER TABLE public.workout_preset_exercises
  ADD COLUMN IF NOT EXISTS notes text;
