import { z } from 'zod'

export const ModeTransitionSchema = z.object({
  turn: z.number(),
  mode: z.enum(['understanding', 'socratic']),
})

export const MisconceptionSchema = z.object({
  misconception: z.string(),
  correction: z.string(),
})

export const EvaluationReportSchema = z.object({
  overall_score: z.number().min(0).max(100),
  accuracy_score: z.number().min(0).max(100),
  coverage_score: z.number().min(0).max(100),
  conceptual_gaps: z.array(z.string()),
  misconceptions: z.array(MisconceptionSchema),
  common_topic_misconceptions: z.array(MisconceptionSchema).default([]),
  improvement_suggestions: z.array(z.string()),
  confidence_flag: z.boolean(),
  session_narrative: z.string(),
  mode_transitions: z.array(ModeTransitionSchema),
  reference_valid: z.boolean(),
  reference_alignment: z.boolean(),
  answer_topic_match: z.boolean(),
  topic_relevance: z.number().min(0).max(1).optional(),
  factual_correctness: z.number().min(0).max(100).optional(),
  final_score: z.union([z.number().min(0).max(100), z.null()]),
})

export type EvaluationReport = z.infer<typeof EvaluationReportSchema>
export type Misconception = z.infer<typeof MisconceptionSchema>
export type ModeTransition = z.infer<typeof ModeTransitionSchema>
