-- Expo tokens are high-entropy identifiers. A digest lets registration disable
-- the same physical push destination under a previous account without storing
-- or querying the plaintext token.
ALTER TABLE public.engagement_devices
  ADD COLUMN token_hash CHAR(64);
CREATE UNIQUE INDEX engagement_devices_token_hash_idx
  ON public.engagement_devices (token_hash)
  WHERE enabled = TRUE AND token_hash IS NOT NULL;
