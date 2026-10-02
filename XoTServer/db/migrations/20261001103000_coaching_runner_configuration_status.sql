-- Expose a repairable CLI/schema configuration failure without persisting diagnostics.
ALTER TABLE public.coaching_runs DROP CONSTRAINT coaching_runs_failure_code_check;
ALTER TABLE public.coaching_runs ADD CONSTRAINT coaching_runs_failure_code_check
  CHECK (failure_code IN ('configuration','authentication','quota','connectivity','timeout','invalid_output','cancelled','internal'));
