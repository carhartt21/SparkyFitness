-- A migration added after the Better Auth transition must reference its owner
-- table, not the retired auth.users table. Preserve all version/diary records.
ALTER TABLE public.workout_plan_template_versions
  DROP CONSTRAINT IF EXISTS workout_plan_template_versions_user_id_fkey;
ALTER TABLE public.workout_plan_template_versions
  ADD CONSTRAINT workout_plan_template_versions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
