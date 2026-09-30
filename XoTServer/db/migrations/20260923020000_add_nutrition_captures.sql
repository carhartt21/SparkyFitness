-- Photo-first eating events exist independently of calorie-bearing food rows.
-- A missing nutrient estimate is represented by absence, never by zero.
CREATE TABLE IF NOT EXISTS public.nutrition_captures (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL,
  entry_date date NOT NULL,
  meal_type_id uuid NULL REFERENCES public.meal_types(id) ON DELETE SET NULL,
  notes text NULL,
  completion_state text NOT NULL DEFAULT 'incomplete'
    CHECK (completion_state IN ('incomplete', 'complete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_captures_user_date
  ON public.nutrition_captures (user_id, entry_date, consumed_at);

CREATE TABLE IF NOT EXISTS public.nutrition_capture_images (
  id uuid PRIMARY KEY,
  capture_id uuid NOT NULL REFERENCES public.nutrition_captures(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_capture_images_capture
  ON public.nutrition_capture_images (capture_id);

ALTER TABLE public.nutrition_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_capture_images ENABLE ROW LEVEL SECURITY;
-- Owner policies are installed by db/rls_policies.sql after migrations.
-- That file is reapplied on every startup and purges old policies first.
