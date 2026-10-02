-- Wellness activities reuse completion habits and their dated logs. An empty
-- schedule keeps occasional activities out of progress tasks and reminders,
-- including for older clients which do not yet understand habit_category.
ALTER TABLE public.custom_categories
  ADD COLUMN habit_category TEXT NOT NULL DEFAULT 'habit'
    CHECK (habit_category IN ('habit', 'wellness')),
  DROP CONSTRAINT custom_categories_habit_days_check,
  ADD CONSTRAINT custom_categories_habit_days_check CHECK (
    habit_days IS NULL OR (
      cardinality(habit_days) BETWEEN 0 AND 7
      AND habit_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
      AND (cardinality(habit_days) > 0 OR habit_category = 'wellness')
    )
  ),
  ADD CONSTRAINT custom_categories_wellness_shape CHECK (
    habit_category <> 'wellness' OR (
      habit_type IS NOT NULL AND habit_type = 'completion'
      AND habit_days IS NOT NULL AND cardinality(habit_days) = 0
      AND habit_reminder_time IS NULL
      AND habit_target IS NULL AND habit_step IS NULL
    )
  );
