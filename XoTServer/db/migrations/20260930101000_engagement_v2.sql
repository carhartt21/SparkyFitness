ALTER TABLE engagement_settings
  ADD COLUMN schedule_initialized boolean NOT NULL DEFAULT false,
  ADD COLUMN daily_limit integer DEFAULT 3 CHECK (daily_limit BETWEEN 1 AND 50),
  ADD COLUMN schedule_config jsonb NOT NULL DEFAULT '{"hydration_interval_hours":2,"hydration_start":"08:00","hydration_end":"22:00","meal_capture_start":"12:00","meal_capture_end":"14:00","meal_capture_time":"13:00","meal_review_time":"20:00","movement_break_time":"15:00"}';
ALTER TABLE engagement_devices
  ADD COLUMN protocol_version integer NOT NULL DEFAULT 1,
  ADD COLUMN reminder_kinds jsonb NOT NULL DEFAULT '["hydration","meal_capture","meal_review","movement_break","mobility"]',
  ADD COLUMN delivery_owner text NOT NULL DEFAULT 'remote' CHECK (delivery_owner IN ('local','remote')),
  ADD COLUMN language text CHECK (language IN ('en','de'));
ALTER TABLE engagement_occurrences DROP CONSTRAINT engagement_occurrences_kind_check;
ALTER TABLE engagement_occurrences ADD CONSTRAINT engagement_occurrences_kind_check
  CHECK (kind IN ('hydration','meal_capture','meal_review','movement_break','mobility','check_in','habit','weigh_in'));
ALTER TABLE engagement_occurrences ADD COLUMN subject_id text NOT NULL DEFAULT '',
  ADD COLUMN settings_revision integer NOT NULL DEFAULT 0;
ALTER TABLE engagement_occurrences DROP CONSTRAINT engagement_occurrences_user_id_kind_local_day_scheduled_at_key;
ALTER TABLE engagement_occurrences ADD COLUMN slot_key text;
UPDATE engagement_occurrences SET slot_key=id::text;
ALTER TABLE engagement_occurrences ALTER COLUMN slot_key SET NOT NULL;
CREATE UNIQUE INDEX engagement_occurrence_subject_slot ON engagement_occurrences(user_id,slot_key);
UPDATE engagement_occurrences SET status='cancelled' WHERE status='pending';
-- A timer-start hint suppresses its reminder, without claiming exercise or calories.
CREATE TABLE engagement_subject_states (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind='movement_break'),
  subject_id uuid NOT NULL, started_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,kind,subject_id)
);
