-- The history table was introduced after Better Auth, but referenced the
-- retired auth.users table. Keep every version and use the same owner as plans.
-- PostgreSQL validates existing rows; an orphan fails the migration visibly.
ALTER TABLE public.workout_plan_template_versions
    DROP CONSTRAINT workout_plan_template_versions_user_id_fkey;

ALTER TABLE public.workout_plan_template_versions
    ADD CONSTRAINT workout_plan_template_versions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
