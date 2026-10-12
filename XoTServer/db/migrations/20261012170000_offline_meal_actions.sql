-- Keep replay identity after deletion of the meal and its ingredient entries.
CREATE TABLE public.offline_meal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  client_operation_id UUID NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  entry_date DATE NOT NULL,
  meal_entry_id UUID REFERENCES public.food_entry_meals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_operation_id)
);
COMMENT ON TABLE public.offline_meal_actions IS
  'Owner-only offline meal retry receipts; deleting a diary meal never reopens an operation.';
