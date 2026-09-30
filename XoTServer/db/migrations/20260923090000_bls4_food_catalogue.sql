BEGIN;

CREATE TABLE public.bls4_foods (
  code text PRIMARY KEY,
  name_de text NOT NULL,
  name_en text NOT NULL,
  nutrients jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  origins jsonb NOT NULL DEFAULT '{}'::jsonb,
  nutrient_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  dataset_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bls4_code_nonempty CHECK (length(code) > 0),
  CONSTRAINT bls4_nutrients_object CHECK (jsonb_typeof(nutrients) = 'object')
);

CREATE INDEX bls4_foods_name_de_idx ON public.bls4_foods (lower(name_de) text_pattern_ops);
CREATE INDEX bls4_foods_name_en_idx ON public.bls4_foods (lower(name_en) text_pattern_ops);

INSERT INTO public.external_provider_types
  (id, display_name, description, is_strictly_private, categories, required_fields, supports_barcode)
VALUES
  ('bls4', 'BLS 4.0 · Max Rubner-Institut',
   'Max Rubner-Institut Bundeslebensmittelschlüssel 4.0, CC BY 4.0; reference nutrients per 100 g.',
   false, ARRAY['food'], ARRAY[]::varchar[], false)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  categories = EXCLUDED.categories,
  required_fields = EXCLUDED.required_fields,
  supports_barcode = EXCLUDED.supports_barcode;

-- Existing installations get one public provider. The first-admin trigger below
-- covers fresh databases, where no user exists yet when migrations run.
INSERT INTO public.external_data_providers
  (user_id, provider_name, provider_type, is_active, is_public, created_at, updated_at)
SELECT id, 'BLS 4.0 · Max Rubner-Institut', 'bls4', true, true, now(), now()
FROM public."user" WHERE role = 'admin'
ORDER BY created_at LIMIT 1
ON CONFLICT (user_id, provider_name) DO UPDATE SET is_public = true;

CREATE FUNCTION public.seed_bls4_provider_for_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.external_data_providers
    WHERE provider_type = 'bls4' AND is_public = true
  ) THEN
    INSERT INTO public.external_data_providers
      (user_id, provider_name, provider_type, is_active, is_public, created_at, updated_at)
    VALUES (NEW.id, 'BLS 4.0 · Max Rubner-Institut', 'bls4', true, true, now(), now())
    ON CONFLICT (user_id, provider_name) DO UPDATE SET is_public = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_bls4_provider_after_user
AFTER INSERT ON public."user"
FOR EACH ROW EXECUTE FUNCTION public.seed_bls4_provider_for_first_admin();

COMMIT;
