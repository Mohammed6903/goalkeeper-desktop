/**
 * LLM-facing draft schemas + coercers.
 *
 * Gemini's structured-output mode is happiest with flat, explicit fields: it stumbles on
 * free-form dicts and optional unions, and is unreliable with numeric types. So every value
 * the model produces is a plain string/bool/list here, and the coercers below convert them
 * into clean domain types. This is a direct port of agents/schemas.py.
 * These schemas constrain the model's output; core/models.ts holds the real storage shapes.
 */

import { z } from 'zod'
import { Priority } from '@core/models'

// ---- numeric / enum coercers -----------------------------------------------------------

/** Parse a float from a string. Returns null for empty/whitespace/non-numeric input. */
export function num(s: string): number | null {
  const trimmed = String(s).trim()
  if (trimmed === '') return null
  const v = parseFloat(trimmed)
  return isNaN(v) ? null : v
}

/** Parse an integer from a string (truncates toward zero). Returns null on bad input. */
export function asInt(s: string): number | null {
  const v = num(s)
  return v !== null ? Math.trunc(v) : null
}

/** Coerce a string to a Priority value; invalid input defaults to 'none'. */
export function coercePriority(s: string): 'high' | 'medium' | 'low' | 'none' {
  const lower = String(s).trim().toLowerCase()
  const valid = [Priority.HIGH, Priority.MEDIUM, Priority.LOW, Priority.NONE] as const
  return (valid as readonly string[]).includes(lower)
    ? (lower as 'high' | 'medium' | 'low' | 'none')
    : 'none'
}

// ---- decompose (plan extraction) -------------------------------------------------------

export const draftTaskSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  priority: z.string().default('none'),         // high|medium|low|none — coerced later
  due_offset_days: z.string().default(''),      // days from today; '' = no due date
  estimate_minutes: z.string().default(''),
  tags: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),  // 1-based task numbers within this project
})

export const draftProjectSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  tasks: z.array(draftTaskSchema).default([]),
})

export const draftPlanSchema = z.object({
  projects: z.array(draftProjectSchema).default([]),
})

// ---- what-now --------------------------------------------------------------------------

export const draftPickSchema = z.object({
  ref: z.string(),   // the task seq we showed the model
  reason: z.string().default(''),
})

export const whatNowResultSchema = z.object({
  summary: z.string().default(''),
  shortlist: z.array(draftPickSchema).default([]),
})

// ---- groom -----------------------------------------------------------------------------

export const draftChangeOpSchema = z.object({
  op: z.string(),         // split | set_deadline | set_priority | add_tag | merge_duplicate | mark_stale
  task_ref: z.string(),   // task seq the op targets
  detail: z.string().default(''),      // human explanation of why
  value: z.string().default(''),       // new deadline (YYYY-MM-DD) / priority / tag, depending on op
  subtasks: z.array(z.string()).default([]),  // for split
  merge_into: z.string().default(''),  // for merge_duplicate: the seq to keep
})

export const groomResultSchema = z.object({
  ops: z.array(draftChangeOpSchema).default([]),
})

// ---- tune ------------------------------------------------------------------------------

export const draftCoeffDeltaSchema = z.object({
  name: z.string(),        // an UrgencyConfig field name
  new_value: z.string(),   // proposed value (string number)
  reason: z.string().default(''),
})

export const tuneResultSchema = z.object({
  summary: z.string().default(''),
  deltas: z.array(draftCoeffDeltaSchema).default([]),
})

// ---- inferred types --------------------------------------------------------------------

export type DraftTask = z.infer<typeof draftTaskSchema>
export type DraftProject = z.infer<typeof draftProjectSchema>
export type DraftPlan = z.infer<typeof draftPlanSchema>
export type DraftPick = z.infer<typeof draftPickSchema>
export type WhatNowResult = z.infer<typeof whatNowResultSchema>
export type DraftChangeOp = z.infer<typeof draftChangeOpSchema>
export type GroomResult = z.infer<typeof groomResultSchema>
export type DraftCoeffDelta = z.infer<typeof draftCoeffDeltaSchema>
export type TuneResult = z.infer<typeof tuneResultSchema>
