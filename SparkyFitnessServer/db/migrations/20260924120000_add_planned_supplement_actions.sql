-- An offline reminder response is an immutable operation, separate from the
-- mutable adherence entry it creates. Keeping this row after entry deletion
-- prevents a late retry from resurrecting a dose the user deliberately removed.
CREATE TABLE public.planned_supplement_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    client_operation_id UUID NOT NULL,
    medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
    -- The original schedule identity survives schedule deletion for replay and
    -- occurrence uniqueness. It is never accepted from the client separately.
    occurrence_schedule_id UUID NOT NULL,
    entry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('taken', 'skipped')),
    occurred_at TIMESTAMPTZ NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    entry_id UUID REFERENCES public.medication_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT planned_supplement_actions_operation_unique
      UNIQUE (user_id, client_operation_id),
    CONSTRAINT planned_supplement_actions_occurrence_unique
      UNIQUE (user_id, occurrence_schedule_id, entry_date)
);

CREATE INDEX planned_supplement_actions_entry_id_idx
  ON public.planned_supplement_actions (entry_id)
  WHERE entry_id IS NOT NULL;

COMMENT ON TABLE public.planned_supplement_actions IS
  'Immutable offline planned-supplement response ledger. Retains replay identity after an adherence entry is deleted.';
