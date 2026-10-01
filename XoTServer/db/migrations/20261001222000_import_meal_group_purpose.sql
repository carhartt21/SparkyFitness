ALTER TABLE public.meal_types
    ADD COLUMN purpose VARCHAR(16) NOT NULL DEFAULT 'regular',
    ADD CONSTRAINT meal_type_purpose CHECK (purpose IN ('regular', 'import'));

-- Backfill only the importer's reserved group with actual FDDB provenance.
-- Do not classify arbitrary custom names or change any food-entry snapshots.
UPDATE public.meal_types mt SET purpose = 'import'
WHERE mt.user_id IS NOT NULL AND mt.name = 'FDDB Import'
  AND EXISTS (SELECT 1 FROM public.food_entries fe
              WHERE fe.meal_type_id = mt.id AND fe.user_id = mt.user_id AND fe.source = 'fddb');

COMMENT ON COLUMN public.meal_types.purpose IS
    'Import-only groups appear in the diary only on dates with actual entries and do not contribute routine meal tasks.';
