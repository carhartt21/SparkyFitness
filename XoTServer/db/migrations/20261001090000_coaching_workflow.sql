-- Coaching is an owner-only proposal/review domain. Credentials may stage
-- recommendations, but app-session approval is required for live mutations.
CREATE TABLE public.coaching_settings (
  user_id UUID PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  data JSONB NOT NULL,
  reconsider_topics TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.coaching_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domains TEXT[] NOT NULL CHECK (domains <@ ARRAY['nutrition','activity','recovery','habits','measurements']::text[] AND cardinality(domains) > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  key_id TEXT,
  oauth_client_id TEXT,
  expires_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  CHECK (NOT (key_id IS NOT NULL AND oauth_client_id IS NOT NULL))
);
CREATE UNIQUE INDEX coaching_agents_key_idx ON public.coaching_agents(key_id) WHERE key_id IS NOT NULL;
CREATE UNIQUE INDEX coaching_agents_oauth_idx ON public.coaching_agents(user_id, oauth_client_id) WHERE oauth_client_id IS NOT NULL;
CREATE TABLE public.coaching_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  agent_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('daily','weekly','manual')),
  slot_key TEXT NOT NULL,
  from_day DATE NOT NULL,
  to_day DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','expired')),
  lease_token_hash CHAR(64),
  lease_until TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  failure_code TEXT CHECK (failure_code IN ('authentication','quota','connectivity','timeout','invalid_output','cancelled','internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot_key),
  UNIQUE(user_id, id),
  FOREIGN KEY(user_id, agent_id) REFERENCES public.coaching_agents(user_id,id) ON DELETE CASCADE,
  CHECK (from_day <= to_day)
);
CREATE INDEX coaching_runs_owner_status_idx ON public.coaching_runs(user_id,status,created_at DESC);
CREATE TABLE public.coaching_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  from_day DATE NOT NULL,
  to_day DATE NOT NULL,
  rows JSONB NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
  warnings TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,id),
  UNIQUE(run_id),
  FOREIGN KEY(user_id,run_id) REFERENCES public.coaching_runs(user_id,id) ON DELETE CASCADE
);
CREATE TABLE public.coaching_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  snapshot_id UUID NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  topic TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('nutrition','activity','recovery','habits','measurements')),
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged','pending','accepted','declined','expired','superseded')),
  data JSONB NOT NULL,
  -- Retained evidence contains only the cited frozen rows, not a raw diary.
  evidence JSONB NOT NULL,
  expires_day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  activation_id UUID,
  accepted_action JSONB,
  UNIQUE(user_id,id)
);
CREATE INDEX coaching_proposals_inbox_idx ON public.coaching_proposals(user_id,status,published_at DESC);
CREATE INDEX coaching_proposals_topic_idx ON public.coaching_proposals(user_id,topic,reviewed_at DESC);
CREATE TABLE public.coaching_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','skipped','stopped','expired')),
  data JSONB NOT NULL,
  success JSONB NOT NULL,
  activation_refs JSONB NOT NULL DEFAULT '[]',
  outcome JSONB,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,id),
  UNIQUE(proposal_id),
  FOREIGN KEY(user_id,proposal_id) REFERENCES public.coaching_proposals(user_id,id) ON DELETE CASCADE
);
CREATE TABLE public.coaching_events (
  sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  proposal_id UUID,
  action_id UUID,
  kind TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,proposal_id) REFERENCES public.coaching_proposals(user_id,id) ON DELETE CASCADE,
  FOREIGN KEY(user_id,action_id) REFERENCES public.coaching_actions(user_id,id) ON DELETE CASCADE
);
CREATE INDEX coaching_events_owner_cursor_idx ON public.coaching_events(user_id,sequence);
CREATE TABLE public.coaching_operations (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  agent_id UUID,
  request_hash CHAR(64) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation_id),
  FOREIGN KEY(user_id,agent_id) REFERENCES public.coaching_agents(user_id,id) ON DELETE CASCADE
);
CREATE TABLE public.coaching_previews (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  token CHAR(64) NOT NULL,
  proposal_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  action JSONB NOT NULL,
  state_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(user_id,token),
  FOREIGN KEY(user_id,proposal_id) REFERENCES public.coaching_proposals(user_id,id) ON DELETE CASCADE
);

ALTER TABLE public.meal_plan_templates ADD COLUMN entry_mode TEXT NOT NULL DEFAULT 'prefill' CHECK (entry_mode IN ('prefill','prompt'));
CREATE TABLE public.meal_plan_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  template_id UUID,
  effective_from DATE NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,id),
  FOREIGN KEY(template_id) REFERENCES public.meal_plan_templates(id) ON DELETE SET NULL
);
CREATE INDEX meal_plan_versions_effective_idx ON public.meal_plan_template_versions(user_id,template_id,effective_from DESC,created_at DESC);
ALTER TABLE public.meal_plans
  ADD COLUMN template_version_id UUID REFERENCES public.meal_plan_template_versions(id) ON DELETE SET NULL,
  ADD COLUMN assignment_id UUID,
  ADD COLUMN state TEXT NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','confirmed','skipped','cancelled')),
  ADD COLUMN item_snapshot JSONB;
CREATE UNIQUE INDEX meal_plans_occurrence_idx ON public.meal_plans(user_id,template_version_id,assignment_id,plan_date) WHERE template_version_id IS NOT NULL;
CREATE TABLE public.meal_plan_log_receipts (
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  request_hash CHAR(64) NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation_id),
  UNIQUE(user_id,plan_id)
);
-- Keep receipts even after a diary or dated plan row is deleted.
COMMENT ON TABLE public.meal_plan_log_receipts IS 'Owner confirmation receipts; no diary mutation occurs on plan acceptance.';

CREATE FUNCTION public.coaching_immutable_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence and plan versions are immutable';
END;
$$;
CREATE TRIGGER coaching_snapshot_no_update BEFORE UPDATE ON public.coaching_snapshots FOR EACH ROW EXECUTE FUNCTION public.coaching_immutable_snapshot();
-- Allow only the template FK to be cleared when a library template is deleted.
CREATE FUNCTION public.meal_version_immutable_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.definition IS DISTINCT FROM OLD.definition OR NEW.effective_from <> OLD.effective_from OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Meal plan version contents are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER meal_version_no_content_update BEFORE UPDATE ON public.meal_plan_template_versions FOR EACH ROW EXECUTE FUNCTION public.meal_version_immutable_definition();
