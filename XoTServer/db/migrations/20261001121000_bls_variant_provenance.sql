-- Repair may only use the same source dataset that created an imported variant.
ALTER TABLE public.food_variants
  ADD COLUMN provider_dataset_sha256 text
  CHECK (provider_dataset_sha256 IS NULL OR provider_dataset_sha256 ~ '^[0-9a-f]{64}$');
