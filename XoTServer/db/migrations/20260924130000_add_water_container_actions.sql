-- A container press can create both a food diary entry and a water log. Keep
-- its operation identity after either entry is deleted so an offline replay
-- cannot recreate a drink the user deliberately removed.
CREATE TABLE public.water_container_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    client_operation_id UUID NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    entry_date DATE NOT NULL,
    container_id INTEGER NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL,
    water_ml NUMERIC NOT NULL CHECK (water_ml >= 0 AND water_ml <= 10000),
    water_log_id UUID REFERENCES public.water_intake_entries(id) ON DELETE SET NULL,
    food_entry_id UUID REFERENCES public.food_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT water_container_actions_operation_unique
      UNIQUE (user_id, client_operation_id)
);

COMMENT ON TABLE public.water_container_actions IS
  'Immutable container-press receipts. The food and water IDs are nullable because deleting either effect must not reopen the operation for replay.';
