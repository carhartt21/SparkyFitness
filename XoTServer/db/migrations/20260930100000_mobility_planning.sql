-- Owner-only mobility definitions and immutable occurrence/session snapshots.
CREATE TABLE mobility_routines (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL, revision integer NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL, deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, id)
);
CREATE TABLE mobility_schedules (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL, routine_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), data jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id), FOREIGN KEY (user_id, routine_id) REFERENCES mobility_routines(user_id, id)
);
CREATE TABLE mobility_plans (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL, schedule_id uuid, local_day date NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), data jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id), UNIQUE (user_id, schedule_id, local_day)
);
CREATE TABLE mobility_sessions (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL, plan_id uuid,
  revision integer NOT NULL CHECK (revision > 0), data jsonb NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('phone', 'web', 'mcp', 'import')),
  deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE UNIQUE INDEX mobility_active_plan ON mobility_sessions (user_id, plan_id)
  WHERE plan_id IS NOT NULL AND NOT deleted AND data->>'state' IN ('running', 'paused');
CREATE TABLE mobility_operations (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL, request_fingerprint text NOT NULL,
  result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, operation_id)
);
CREATE INDEX mobility_plans_day ON mobility_plans (user_id, local_day);
CREATE INDEX mobility_sessions_time ON mobility_sessions (user_id, updated_at);
