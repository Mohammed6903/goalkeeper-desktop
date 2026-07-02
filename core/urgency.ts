/**
 * Deterministic urgency scoring — a Taskwarrior-style polynomial.
 *
 * Ported 1:1 from GoalKeeper's Python `urgency.py`. The formula is a weighted sum of
 * independent terms; only the coefficients in UrgencyConfig can change.
 *
 * Rounding: Python uses `round(score, 4)` (banker's rounding / round-half-to-even).
 * JS `Math.round` rounds half-up. For all values produced by the default coefficients
 * the two strategies produce identical results (no .5-at-4th-decimal edge cases arise).
 * The round helper below applies `Math.round(x * 10000) / 10000` which matches Python
 * for every case exercised by the parity test suite.
 */

import type { UrgencyConfig } from './config'
import { Priority, Status, type Task } from './models'

/** Fractional scale matching Python's _PRIORITY_SCALE dict. */
const PRIORITY_SCALE: Record<string, number> = {
  high: 1.0,
  medium: 0.65,
  low: 0.3,
  none: 0.0,
}

const priorityTerm = (p: string, c: UrgencyConfig): number =>
  ({ high: c.priority_high, medium: c.priority_medium, low: c.priority_low, none: 0 }[p] ?? 0)

/**
 * Whole-day difference (b - a) in UTC calendar days, matching Python `(date_b - date_a).days`.
 * Both arguments must be YYYY-MM-DD strings.
 */
const dayDiff = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((db - da) / 86_400_000)
}

/** Extract the wall-clock calendar date (YYYY-MM-DD) from an ISO-8601 datetime string.
 * Matches Python's `fromisoformat().date()`: takes the leading YYYY-MM-DD directly from
 * the string, ignoring any timezone offset, so the result is timezone-independent. */
const createdDate = (t: Task): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t.created_at)
  return m ? m[1] : null
}

export interface UrgencyCtx {
  now: string
  coeffs: UrgencyConfig
  blockingCount?: number
  isBlocked?: boolean
  goalPriority?: string
}

/**
 * Compute a task's urgency score.
 *
 * - `blockingCount`: number of not-done tasks that depend on this one.
 * - `isBlocked`: true if this task has an unfinished dependency.
 * - `goalPriority`: priority of the task's owning goal (inherited fractionally).
 */
export function urgency(task: Task, ctx: UrgencyCtx): number {
  const {
    now,
    coeffs: c,
    blockingCount = 0,
    isBlocked = false,
    goalPriority = Priority.NONE,
  } = ctx

  let score = 0.0

  // Due-date proximity: ramps 0 → due as task approaches over due_horizon_days;
  // flat overdue boost once at or past due date.
  if (task.due != null) {
    const daysUntil = dayDiff(now, task.due)
    if (daysUntil <= 0) {
      score += c.due + c.overdue
    } else if (daysUntil < c.due_horizon_days) {
      const proximity = (c.due_horizon_days - daysUntil) / c.due_horizon_days
      score += c.due * proximity
    }
  }

  // Priority
  score += priorityTerm(task.priority, c)

  // Age: older pending work nudges up, capped at coeffs.age
  const created = createdDate(task)
  if (created != null && c.age_horizon_days > 0) {
    const ageDays = Math.max(0, dayDiff(created, now))
    score += c.age * Math.min(1.0, ageDays / c.age_horizon_days)
  }

  // Active (started but not done)
  if (task.status === Status.ACTIVE) score += c.active

  // Dependency graph: blocking others raises urgency; being blocked lowers it
  if (blockingCount > 0) score += c.blocking
  if (isBlocked) score += c.blocked

  // Special +next tag
  if (task.tags.includes('next')) score += c.tag_next

  // Inherit a fraction of the parent goal's priority
  score += c.goal_priority * (PRIORITY_SCALE[goalPriority] ?? 0)

  // Match Python `round(score, 4)`
  return Math.round(score * 10000) / 10000
}
