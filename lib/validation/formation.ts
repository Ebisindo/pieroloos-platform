import { z } from "zod";

export const formationStepSchema = z.object({
  stage: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  order: z.number().int().min(0),
  required: z.boolean(),
});
