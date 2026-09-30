-- Source is a trusted ingress label, not client-asserted proof of a phone.
ALTER TABLE mobility_sessions DROP CONSTRAINT mobility_sessions_provenance_check;
ALTER TABLE mobility_sessions ADD CONSTRAINT mobility_sessions_provenance_check
  CHECK (provenance IN ('api','phone','web','mcp','import'));
-- Bounded owner-scoped receipt cleanup; retained record revisions still reject stale replays.
CREATE INDEX mobility_operations_expiry ON mobility_operations(user_id,created_at);

