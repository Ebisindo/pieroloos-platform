import { z } from "zod";

export const jurisdictionCriterionSchema = z.object({ key: z.string().min(1), label: z.string().min(1), weight: z.number().min(0) });
export const jurisdictionObservationSchema = z.object({ jurisdictionId: z.string().min(1), criterionKey: z.string().min(1), value: z.number(), evidenceIds: z.array(z.string()), assumptions: z.array(z.string()), reviewRequired: z.boolean() });
export const jurisdictionComparisonSchema = z.object({ criteria: z.array(jurisdictionCriterionSchema), observations: z.array(jurisdictionObservationSchema) });
