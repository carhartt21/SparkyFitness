-- Daily tracking batch: check-in, health context periods, habit configuration,
-- measurement reminders, explicit meal status and Daily Progress preferences.
-- Every table stores explicit user records only. Absence means "not recorded";
-- nothing here is inferred from other domains.

-- One reflective check-in per account day. A skipped check-in carries no
-- responses; a completed check-in must carry at least one response.
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'completed', 'skipped')),
  -- Versioned question set; response meanings never change within a version.
  question_version SMALLINT NOT NULL DEFAULT 1 CHECK (question_version >= 1),
  overall_day SMALLINT CHECK (overall_day BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  stress SMALLINT CHECK (stress BETWEEN 1 AND 5),
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  nutrition_on_track SMALLINT CHECK (nutrition_on_track BETWEEN 1 AND 5),
  activity SMALLINT CHECK (activity BETWEEN 1 AND 5),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
    CHECK (cardinality(tags) <= 20),
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID,
  updated_by_user_id UUID,
  CONSTRAINT daily_checkins_user_day_unique UNIQUE (user_id, entry_date),
  CONSTRAINT daily_checkins_skipped_is_empty CHECK (
    state <> 'skipped' OR (
      overall_day IS NULL AND energy IS NULL AND stress IS NULL
      AND sleep_quality IS NULL AND nutrition_on_track IS NULL
      AND activity IS NULL AND note IS NULL AND cardinality(tags) = 0
    )
  ),
  CONSTRAINT daily_checkins_completed_has_response CHECK (
    state <> 'completed' OR (
      overall_day IS NOT NULL OR energy IS NOT NULL OR stress IS NOT NULL
      OR sleep_quality IS NOT NULL OR nutrition_on_track IS NOT NULL
      OR activity IS NOT NULL OR (note IS NOT NULL AND btrim(note) <> '')
      OR cardinality(tags) > 0
    )
  ),
  CONSTRAINT daily_checkins_state_timestamps CHECK (
    (state = 'completed') = (completed_at IS NOT NULL)
    AND (state = 'skipped') = (skipped_at IS NOT NULL)
  )
);

-- User-declared context such as an injury, illness or vacation. The app never
-- derives a period from other data. end_date NULL means ongoing.
CREATE TABLE public.health_context_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('injury', 'illness', 'vacation')),
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  body_area TEXT CHECK (body_area IS NULL OR char_length(body_area) <= 100),
  limitation TEXT CHECK (limitation IS NULL OR char_length(limitation) <= 500),
  -- Pauses optional (discretionary) reminders only; scheduled medication and
  -- supplement reminders are never affected.
  pause_discretionary_reminders BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT health_context_periods_range CHECK (
    end_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT health_context_periods_injury_fields CHECK (
    kind = 'injury' OR (body_area IS NULL AND limitation IS NULL)
  )
);
CREATE INDEX health_context_periods_user_range_idx
  ON public.health_context_periods (user_id, start_date, end_date);

-- Habits remain custom_categories rows (the existing chatbot habit model) with
-- configuration columns. habit_type NULL means an ordinary measurement
-- category. Logs stay in custom_measurements: one row per day; an explicitly
-- saved 0 is a record, a missing row is "not recorded".
ALTER TABLE public.custom_categories
  ADD COLUMN habit_type TEXT CHECK (habit_type IN ('completion', 'count')),
  ADD COLUMN habit_description TEXT
    CHECK (habit_description IS NULL OR char_length(habit_description) <= 300),
  ADD COLUMN habit_target NUMERIC CHECK (habit_target IS NULL OR habit_target > 0),
  ADD COLUMN habit_step NUMERIC CHECK (habit_step IS NULL OR habit_step > 0),
  -- 0 = Sunday ... 6 = Saturday; NULL means every day.
  ADD COLUMN habit_days SMALLINT[] CHECK (
    habit_days IS NULL OR (
      cardinality(habit_days) BETWEEN 1 AND 7
      AND habit_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
    )
  ),
  ADD COLUMN habit_reminder_time TIME,
  ADD COLUMN habit_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN habit_sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN habit_icon TEXT CHECK (habit_icon IS NULL OR char_length(habit_icon) <= 50),
  ADD CONSTRAINT custom_categories_habit_shape CHECK (
    habit_type IS NULL OR (
      frequency = 'Daily' AND (
        (habit_type = 'completion' AND data_type = 'boolean'
          AND habit_target IS NULL AND habit_step IS NULL)
        OR (habit_type = 'count' AND data_type = 'numeric')
      )
    )
  );
CREATE INDEX custom_categories_habits_idx
  ON public.custom_categories (user_id, habit_sort_order)
  WHERE habit_type IS NOT NULL;

-- Optional measurement reminders. measurement_key is 'weight' for the
-- check-in weight or 'custom:<category uuid>' for a custom measurement.
CREATE TABLE public.measurement_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  measurement_key TEXT NOT NULL CHECK (
    measurement_key = 'weight'
    OR measurement_key ~ '^custom:[0-9a-f-]{36}$'
  ),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  days SMALLINT[] CHECK (
    days IS NULL OR (
      cardinality(days) BETWEEN 1 AND 7
      AND days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
    )
  ),
  daypart TEXT NOT NULL DEFAULT 'morning'
    CHECK (daypart IN ('morning', 'midday', 'evening')),
  reminder_time TIME NOT NULL DEFAULT '07:30',
  include_in_daily_progress BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT measurement_reminders_user_key_unique UNIQUE (user_id, measurement_key)
);

-- Explicit per-meal resolution. No row means PENDING. Foods on a meal never
-- imply COMPLETE; SKIPPED means the user had no meal.
CREATE TABLE public.meal_day_statuses (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  meal_type_id UUID NOT NULL REFERENCES public.meal_types(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('complete', 'skipped', 'incomplete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID,
  updated_by_user_id UUID,
  PRIMARY KEY (user_id, entry_date, meal_type_id)
);

-- Which explicit daily tasks count toward Daily Progress, plus the optional
-- check-in reminder. Absence of a row means the defaults below.
CREATE TABLE public.daily_tracking_preferences (
  user_id UUID PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  include_checkin BOOLEAN NOT NULL DEFAULT TRUE,
  include_habits BOOLEAN NOT NULL DEFAULT TRUE,
  include_supplements BOOLEAN NOT NULL DEFAULT TRUE,
  include_meals BOOLEAN NOT NULL DEFAULT FALSE,
  checkin_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  checkin_reminder_time TIME NOT NULL DEFAULT '20:30',
  habit_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_day_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tracking_preferences ENABLE ROW LEVEL SECURITY;
-- Policies are installed by db/rls_policies.sql after migrations.

COMMENT ON TABLE public.daily_checkins IS
  'User-entered daily reflection. Skipped rows carry no responses; completed rows carry at least one.';
COMMENT ON TABLE public.health_context_periods IS
  'User-declared injury, illness or vacation periods. Never inferred.';
COMMENT ON TABLE public.meal_day_statuses IS
  'Explicit meal resolution per day. No row means pending; logged foods never imply complete.';
