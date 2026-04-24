import { z } from "zod";

export const ReviewSchema = z.object({
  verdict: z.enum(["Pass", "Conditional Pass", "Needs Improvement", "Fail"]),
  confidence: z.number().min(0).max(100),
  bugs: z.array(z.string()),
  security: z.array(z.string()),
  tests: z.array(z.string()),
  edgeCases: z.array(z.string()),
  notes: z.string(),
});

export type ReviewOutput = z.infer<typeof ReviewSchema>;

export const PlanStepSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["complete", "in-progress", "pending"]),
});

export const PlanSchema = z.object({
  objective: z.string(),
  steps: z.array(PlanStepSchema).min(3).max(8),
});

export type PlanOutput = z.infer<typeof PlanSchema>;

export const FixEntrySchema = z.object({
  finding: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  remediation: z.string(),
  codeChange: z.string(),
});

export const FixSchema = z.object({
  summary: z.string(),
  fixes: z.array(FixEntrySchema),
  patchedCode: z.string(),
});

export type FixOutput = z.infer<typeof FixSchema>;
