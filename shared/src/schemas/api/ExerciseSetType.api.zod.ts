import { z } from "zod";

// The mobile editor stores short tokens, while the web editor and historical
// imports store display labels. Keep their persisted spelling on writes so a
// saved workout can be edited without silently changing its set types.
const acceptedSetTypeKeys = new Set([
  "normal",
  "standard",
  "working",
  "workingset",
  "warmup",
  "warmupset",
  "drop",
  "dropset",
  "failure",
  "tofailure",
  "amrap",
  "backoff",
  "restpause",
  "cluster",
  "technique",
  "cooldown",
  "cooldownset",
  "rest",
  "restset",
]);

/** Validates client-authored set types without changing historical labels. */
export const exerciseSetTypeRequestSchema = z
  .string()
  .trim()
  .max(64)
  .refine(
    (value) =>
      value === "" ||
      acceptedSetTypeKeys.has(value.toLowerCase().replace(/[^a-z0-9]/g, "")),
    "Unsupported set type",
  )
  .transform((value) => (value === "" ? null : value));
