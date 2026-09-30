-- BLS search ranks candidates before pagination; GIN supports the identity
-- token predicate even when names contain commas or preparation qualifiers.
CREATE INDEX bls4_foods_search_tokens_idx ON public.bls4_foods USING GIN (
  (to_tsvector('german', replace(replace(replace(replace(replace(lower(name_de), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), 'aepfel', 'apfel')) ||
   to_tsvector('english', lower(name_en)))
);
