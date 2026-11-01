import { z } from "zod";

export const reportGenerateSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
}).strict();

export type ReportGenerateInput = z.infer<typeof reportGenerateSchema>;
