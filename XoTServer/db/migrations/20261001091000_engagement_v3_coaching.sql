ALTER TABLE engagement_occurrences DROP CONSTRAINT engagement_occurrences_kind_check;
ALTER TABLE engagement_occurrences ADD CONSTRAINT engagement_occurrences_kind_check
  CHECK (kind IN ('hydration','meal_capture','meal_review','movement_break','mobility','check_in','habit','weigh_in','coaching_digest','coaching_action'));
CREATE UNIQUE INDEX engagement_coaching_digest_day ON engagement_occurrences(user_id,local_day)
  WHERE kind='coaching_digest' AND attempt_count>0;
