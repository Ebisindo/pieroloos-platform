import { z } from "zod";
import { MARKET_ENTRY_STATUSES, MARKET_ENTRY_REVIEW_STATUSES } from "@/lib/domain/market-entry";

export const createMarketEntrySchema = z.object({
  comparisonSnapshotId: z.string().min(1),
  targetJurisdictionId: z.string().min(1),
  rationale: z.string().trim().min(10).max(5000),
  formationPlanId: z.string().min(1).optional(),
});

export const updateMarketEntryStatusSchema = z.object({
  status: z.enum(MARKET_ENTRY_STATUSES),
  expectedVersion: z.number().int().positive(),
});

export const marketEntryReviewSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  note: z.string().trim().min(10).max(5000),
  expectedVersion: z.number().int().positive(),
});

export const marketReadinessResultSchema = z.object({
  status: z.enum(["PREPARATION_INCOMPLETE", "READY_FOR_REVIEW", "REVIEW_RECORDED", "CHANGES_REQUESTED"]),
  assessedAt: z.string().datetime(),
  boundary: z.string(),
  checks: z.array(z.object({
    key: z.string(),
    title: z.string(),
    status: z.enum(["COMPLETE", "IN_PROGRESS", "NEEDS_INPUT", "NOT_CONFIGURED", "REVIEW_REQUIRED", "NOT_ASSESSED"]),
    summary: z.string(),
    completed: z.number().optional(),
    total: z.number().optional(),
    nextSteps: z.array(z.string()),
  })),
});
