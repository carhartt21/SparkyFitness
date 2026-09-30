-- Saved serving portions and the last-used serving per user and food.
--
-- food_variants keeps one row per serving with its own stored nutrition, so
-- every existing reader is unchanged. A portion now also carries a display
-- label, its weight in g or ml, and a user-chosen order. is_default remains
-- the internal marker of the nutrition basis (the row whose nutrition the user
-- edits); it is not a user-facing "default serving".

ALTER TABLE public.food_variants
  ADD COLUMN serving_label TEXT,
  ADD COLUMN metric_amount NUMERIC,
  ADD COLUMN metric_unit TEXT,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.food_variants
  ADD CONSTRAINT food_variants_serving_label_length CHECK (
    serving_label IS NULL
    OR (char_length(btrim(serving_label)) BETWEEN 1 AND 40)
  ),
  ADD CONSTRAINT food_variants_metric_amount_positive CHECK (
    metric_amount IS NULL OR metric_amount > 0
  ),
  ADD CONSTRAINT food_variants_metric_unit_check CHECK (
    metric_unit IS NULL OR metric_unit IN ('g', 'ml')
  ),
  ADD CONSTRAINT food_variants_metric_pair CHECK (
    (metric_amount IS NULL) = (metric_unit IS NULL)
  );

COMMENT ON COLUMN public.food_variants.serving_label IS
  'Optional display name of a saved portion, e.g. "Medium". Never used for nutrition.';
COMMENT ON COLUMN public.food_variants.metric_amount IS
  'Weight (g) or volume (ml) of one serving_size of this row. Set automatically for g/ml rows; stated by the user or a provider otherwise. NULL means unknown, never zero.';
COMMENT ON COLUMN public.food_variants.sort_order IS
  'User-chosen order of saved portions in the editor and in quick add.';

-- A row measured in g or ml states its own weight, and a provider serving
-- saved as "slice (30 g)" states it in its unit. Keeping this in a trigger
-- covers every writer (imports, bulk create, the servings endpoint). A row
-- that stops being metric drops a weight that was only derived from its unit.
CREATE OR REPLACE FUNCTION public.food_variants_sync_metric_weight()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  unit_key TEXT := lower(btrim(NEW.serving_unit));
  unit_context TEXT[] := regexp_match(
    NEW.serving_unit, '\(\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\)\s*$', 'i'
  );
  weight_untouched BOOLEAN := TG_OP = 'UPDATE'
    AND NEW.metric_amount IS NOT DISTINCT FROM OLD.metric_amount
    AND NEW.metric_unit IS NOT DISTINCT FROM OLD.metric_unit;
BEGIN
  IF unit_key IN ('g', 'ml') THEN
    NEW.metric_amount := NEW.serving_size;
    NEW.metric_unit := unit_key;
  ELSIF unit_context IS NOT NULL AND (
    NEW.metric_amount IS NULL
    OR (weight_untouched AND NEW.serving_unit IS DISTINCT FROM OLD.serving_unit)
  ) THEN
    -- The stated weight is per serving_size of the row, like the nutrition.
    NEW.metric_amount := replace(unit_context[1], ',', '.')::NUMERIC;
    NEW.metric_unit := lower(unit_context[2]);
  ELSIF weight_untouched
    AND lower(btrim(OLD.serving_unit)) IN ('g', 'ml') THEN
    NEW.metric_amount := NULL;
    NEW.metric_unit := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER food_variants_sync_metric_weight
BEFORE INSERT OR UPDATE OF serving_size, serving_unit, metric_amount, metric_unit
ON public.food_variants
FOR EACH ROW EXECUTE FUNCTION public.food_variants_sync_metric_weight();

-- Backfill 1: rows measured in g or ml.
UPDATE public.food_variants
SET metric_amount = serving_size,
    metric_unit = lower(btrim(serving_unit))
WHERE lower(btrim(serving_unit)) IN ('g', 'ml');

-- Backfill 1b: provider servings whose unit states the weight ("slice (30 g)");
-- touching the unit lets the trigger parse it.
UPDATE public.food_variants
SET serving_unit = serving_unit
WHERE metric_amount IS NULL
  AND serving_unit ~* '\(\s*\d+([.,]\d+)?\s*(g|ml)\s*\)\s*$';

-- Backfill 2: the older "equivalent unit" rows ("1 cup" saved with exactly the
-- same nutrition as a 100 g row of the same food) describe the same amount, so
-- they weigh what that row weighs. Only unambiguous matches are filled.
WITH matches AS (
  SELECT candidate.id,
         MIN(metric.metric_amount) AS metric_amount,
         MIN(metric.metric_unit) AS metric_unit,
         COUNT(DISTINCT (metric.metric_amount, metric.metric_unit)) AS options
  FROM public.food_variants candidate
  JOIN public.food_variants metric
    ON metric.food_id = candidate.food_id
   AND metric.id <> candidate.id
   AND metric.metric_amount IS NOT NULL
   AND metric.calories IS NOT DISTINCT FROM candidate.calories
   AND metric.protein IS NOT DISTINCT FROM candidate.protein
   AND metric.carbs IS NOT DISTINCT FROM candidate.carbs
   AND metric.fat IS NOT DISTINCT FROM candidate.fat
  WHERE candidate.metric_amount IS NULL
    AND candidate.calories IS NOT NULL
  GROUP BY candidate.id
)
UPDATE public.food_variants fv
SET metric_amount = matches.metric_amount,
    metric_unit = matches.metric_unit
FROM matches
WHERE fv.id = matches.id AND matches.options = 1;

-- Backfill 3: order. The current basis row first, then creation order, so the
-- first serving shown today stays first.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY food_id
           ORDER BY is_default DESC NULLS LAST, created_at, id
         ) - 1 AS position
  FROM public.food_variants
)
UPDATE public.food_variants fv
SET sort_order = ordered.position
FROM ordered
WHERE fv.id = ordered.id AND fv.sort_order IS DISTINCT FROM ordered.position;

CREATE INDEX IF NOT EXISTS idx_food_variants_food_sort
  ON public.food_variants (food_id, sort_order);

-- The amount and unit a user last logged for a food, offered as the first
-- quick-add suggestion. One row per user and food. The label and weight are
-- snapshots so the suggestion still reads correctly if the portion is renamed
-- or deleted.
CREATE TABLE public.food_last_servings (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (char_length(btrim(unit)) BETWEEN 1 AND 50),
  variant_id UUID REFERENCES public.food_variants(id) ON DELETE SET NULL,
  serving_size NUMERIC CHECK (serving_size IS NULL OR serving_size > 0),
  serving_label TEXT CHECK (
    serving_label IS NULL OR char_length(serving_label) <= 40
  ),
  metric_amount NUMERIC CHECK (metric_amount IS NULL OR metric_amount > 0),
  metric_unit TEXT CHECK (metric_unit IS NULL OR metric_unit IN ('g', 'ml')),
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, food_id),
  CONSTRAINT food_last_servings_metric_pair CHECK (
    (metric_amount IS NULL) = (metric_unit IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_food_last_servings_variant
  ON public.food_last_servings (variant_id);
CREATE INDEX IF NOT EXISTS idx_food_last_servings_food
  ON public.food_last_servings (food_id);

ALTER TABLE public.food_last_servings ENABLE ROW LEVEL SECURITY;
-- Policies are installed by db/rls_policies.sql after migrations.

COMMENT ON TABLE public.food_last_servings IS
  'Last serving a user logged by hand for a food. Written by single-food logging only; bulk imports, meals, copies and syncs never update it.';
