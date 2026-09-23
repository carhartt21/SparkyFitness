import { z } from "zod";

export const bls4FoodsSchema = z.object({
  code: z.string(),
  name_de: z.string(),
  name_en: z.string(),
  nutrients: z.record(z.string(), z.number()),
  qualifiers: z.record(z.string(), z.string()),
  origins: z.record(z.string(), z.string()),
  nutrient_references: z.record(z.string(), z.string()),
  dataset_sha256: z.string(),
  imported_at: z.date(),
});

export type Bls4Foods = z.infer<typeof bls4FoodsSchema>;
