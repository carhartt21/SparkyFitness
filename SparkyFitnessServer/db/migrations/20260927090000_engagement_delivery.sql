-- Notification state belongs to the authenticated account, not to the current
-- device. Delivery rows and action receipts remain after source diary edits.
CREATE TABLE public.engagement_settings (
  user_id UUID PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  remote_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_start TIME NOT NULL DEFAULT '22:00',
  quiet_end TIME NOT NULL DEFAULT '08:00',
  hydration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meal_capture_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meal_review_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  movement_break_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mobility_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.engagement_devices (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_tag TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, installation_id)
);

CREATE TABLE public.engagement_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN
    ('hydration', 'meal_capture', 'meal_review', 'movement_break', 'mobility')),
  local_day DATE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'sending', 'sent', 'skipped', 'cancelled', 'failed')),
  delivery_owner TEXT NOT NULL DEFAULT 'remote' CHECK (delivery_owner IN
    ('remote', 'local')),
  sent_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, local_day, scheduled_at)
);
CREATE INDEX engagement_occurrences_due_idx ON public.engagement_occurrences
  (scheduled_at, id) WHERE status IN ('pending', 'sending');
CREATE INDEX engagement_occurrences_user_idx ON public.engagement_occurrences
  (user_id, local_day, scheduled_at);

CREATE TABLE public.engagement_deliveries (
  occurrence_id UUID NOT NULL REFERENCES public.engagement_occurrences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL,
  ticket_id TEXT,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN
    ('claimed', 'accepted', 'delivered', 'failed')),
  error_code TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ,
  PRIMARY KEY (occurrence_id, installation_id),
  FOREIGN KEY (user_id, installation_id)
    REFERENCES public.engagement_devices(user_id, installation_id) ON DELETE CASCADE
);
CREATE INDEX engagement_deliveries_receipts_idx ON public.engagement_deliveries
  (claimed_at) WHERE status = 'accepted';

CREATE TABLE public.engagement_action_receipts (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  occurrence_id UUID NOT NULL REFERENCES public.engagement_occurrences(id) ON DELETE CASCADE,
  request_fingerprint CHAR(64) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, operation_id)
);

CREATE TABLE public.engagement_change_events (
  sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX engagement_change_events_user_idx ON public.engagement_change_events
  (user_id, sequence);

COMMENT ON TABLE public.engagement_occurrences IS
  'Durable owner-selected notification occurrences. Only one of remote or local may deliver an occurrence.';
COMMENT ON TABLE public.engagement_action_receipts IS
  'Immutable idempotency receipts for snooze and skip actions.';
