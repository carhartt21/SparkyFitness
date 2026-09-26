-- Manual/mobile writes use an immutable operation key, separate from provider
-- source/source_id upserts (which may refresh an existing provider snapshot).
-- NULL preserves the behavior of web and other legacy callers.
ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS client_operation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_user_client_operation_id
  ON public.food_entries (user_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

COMMENT ON COLUMN public.food_entries.client_operation_id IS
  'Stable mobile action UUID. Unique per diary owner; retries return the original entry without rewriting its snapshot.';
