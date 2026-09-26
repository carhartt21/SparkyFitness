-- System meal types remain shared identifiers. Each account may customize how
-- they are named and positioned without changing anyone else's diary.
ALTER TABLE public.user_meal_visibilities
  ADD COLUMN IF NOT EXISTS name_override text,
  ADD COLUMN IF NOT EXISTS sort_order_override integer;

ALTER TABLE public.user_meal_visibilities
  ADD CONSTRAINT user_meal_name_override_nonempty
  CHECK (name_override IS NULL OR length(btrim(name_override)) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.user_meal_visibilities.name_override IS
  'Per-user display name for a system meal type; its canonical meal_types.name is unchanged.';
COMMENT ON COLUMN public.user_meal_visibilities.sort_order_override IS
  'Per-user diary ordering for a system meal type; shared sort_order is unchanged.';
