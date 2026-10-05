-- Additive review protocol; installed protocol-1 clients keep their projections.
ALTER TABLE public.coaching_agents
  ADD COLUMN protocol_version INTEGER NOT NULL DEFAULT 1 CHECK (protocol_version IN (1,2)),
  ADD COLUMN context_permissions TEXT[] NOT NULL DEFAULT '{}' CHECK (context_permissions <@ ARRAY['supplement_adherence','notification_history']::text[]),
  ADD COLUMN processed_event_cursor BIGINT NOT NULL DEFAULT 0 CHECK (processed_event_cursor >= 0);
ALTER TABLE public.coaching_settings ADD COLUMN completed_slots JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(completed_slots)='object');
ALTER TABLE public.coaching_runs DROP CONSTRAINT coaching_runs_kind_check;
ALTER TABLE public.coaching_runs ADD CONSTRAINT coaching_runs_kind_check CHECK (kind IN ('daily','weekly','monthly','yearly','manual'));
ALTER TABLE public.coaching_runs ADD COLUMN feedback_cursor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN feedback_through BIGINT NOT NULL DEFAULT 0;
-- No run/agent FK: maintenance and connection removal must not erase published recaps.
-- Publication is unique by retained source run identity, even after that run expires.
CREATE TABLE public.coaching_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  source_run_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('daily','weekly','monthly','yearly','manual')),
  from_day DATE NOT NULL, to_day DATE NOT NULL CHECK (from_day <= to_day),
  data JSONB NOT NULL CHECK (jsonb_typeof(data)='object'),
  evidence JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence)='array'),
  proposal_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ,
  UNIQUE(user_id,source_run_id)
);
CREATE INDEX coaching_recaps_owner_date_idx ON public.coaching_recaps(user_id,created_at DESC,id);
CREATE INDEX coaching_recaps_unread_idx ON public.coaching_recaps(user_id) WHERE read_at IS NULL;
