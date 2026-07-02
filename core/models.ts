/**
 * Domain models: the goals -> projects -> tasks hierarchy plus an append-only event log.
 * Ported from goalkeeper/models.py. Field names are snake_case to match the Python originals.
 */

import { z } from 'zod'

// Use factory functions so each .parse() call gets a fresh value (zod v4 evaluates
// function defaults lazily — on every parse — unlike static value defaults).
// `globalThis.crypto` is the Web Crypto API, present in both Node 18+ and the Electron
// renderer, so this module stays importable from browser code (no `node:crypto`).
export const genId = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)
export const nowIso = () => new Date().toISOString()

export const Priority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none',
} as const

export const Status = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DONE: 'done',
} as const

export const EventKind = {
  CREATED: 'created',
  STARTED: 'started',
  COMPLETED: 'completed',
  MODIFIED: 'modified',
} as const

const priority = z.enum(['high', 'medium', 'low', 'none'])
const status = z.enum(['pending', 'active', 'done'])
const eventKind = z.enum(['created', 'started', 'completed', 'modified'])

export const goalSchema = z.object({
  id: z.string().default(() => genId()),
  title: z.string(),
  description: z.string().default(''),
  horizon: z.string().nullable().default(null), // YYYY-MM-DD date string, nullable
  priority: priority.default('none'),
  status: status.default('pending'),
  created_at: z.string().default(() => nowIso()),
})

export const projectSchema = z.object({
  id: z.string().default(() => genId()),
  goal_id: z.string().nullable().default(null),
  title: z.string(),
  description: z.string().default(''),
  status: status.default('pending'),
  created_at: z.string().default(() => nowIso()),
})

export const taskSchema = z.object({
  id: z.string().default(() => genId()),
  seq: z.number().int().default(0),
  project_id: z.string().nullable().default(null),
  title: z.string(),
  description: z.string().default(''),
  status: status.default('pending'),
  priority: priority.default('none'),
  due: z.string().nullable().default(null), // YYYY-MM-DD date string, nullable
  estimate_minutes: z.number().int().nullable().default(null),
  tags: z.array(z.string()).default([]),
  depends: z.array(z.string()).default([]), // task ids this one waits on
  created_at: z.string().default(() => nowIso()),
  started_at: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  urgency: z.number().default(0), // cached; recomputed by the service/urgency layer
})

export const eventSchema = z.object({
  id: z.string().default(() => genId()),
  ts: z.string().default(() => nowIso()),
  task_id: z.string(),
  kind: eventKind,
  urgency_at: z.number().nullable().default(null),
  urgency_rank_at: z.number().int().nullable().default(null), // 1-based rank among ready tasks
  ready_count_at: z.number().int().nullable().default(null),  // size of the ready list
})

export type Goal = z.infer<typeof goalSchema>
export type Project = z.infer<typeof projectSchema>
export type Task = z.infer<typeof taskSchema>
export type Event = z.infer<typeof eventSchema>
