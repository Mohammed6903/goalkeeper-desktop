/**
 * Urgency auto-tuning: feed the deterministic calibration summary + current coefficients to
 * the LLM, which proposes coefficient deltas to better match how the user actually works.
 * Advisory only — the user reviews and applies in the UI (Task 8.4).
 *
 * Ported from GoalKeeper/src/goalkeeper/judgment/tune.py and
 * GoalKeeper/src/goalkeeper/calibrate.py.
 */

import type { ZodType } from 'zod'
import type { Service } from '@core/service'
import type { UrgencyConfig } from '@core/config'
import type { Event } from '@core/models'
import { EventKind } from '@core/models'
import { tuneResultSchema, type TuneResult } from './schemas'

const _PROMPT = `You tune the coefficients of a task-urgency formula so its ranking better matches
how the user ACTUALLY completes work. Urgency = weighted sum of terms; higher coefficient =
that factor matters more.

Calibration (from real completions):
- mean_normalized_rank is 0 if the user always completes the top-ranked ready task and 1 if
  they always complete the lowest-ranked. Lower = better calibrated. If it is high, the
  current weights disagree with behavior — adjust coefficients toward the factors that the
  "surprises" (tasks completed despite low rank) have in common.

Propose conservative deltas (change only a few coefficients, by modest amounts; keep values
non-negative except \`blocked\` which is negative). Only output coefficients you want to change.

CURRENT COEFFICIENTS (JSON):
{coeffs}

CALIBRATION (JSON):
{calib}
`

/** Port of calibrate.py's `calibration(store)` — deterministic, no LLM. */
function buildCalibration(svc: Service): Record<string, unknown> {
  // Sort events by ts ascending (store does not guarantee order)
  const allEvents: Event[] = svc.store.allEvents().slice().sort((a, b) => {
    if (a.ts < b.ts) return -1
    if (a.ts > b.ts) return 1
    return 0
  })

  const completed = allEvents.filter(
    e => e.kind === EventKind.COMPLETED && e.urgency_rank_at != null && e.ready_count_at != null,
  )
  const usable = completed.filter(e => e.ready_count_at != null && e.ready_count_at > 0)

  if (usable.length === 0) {
    return { n: 0 }
  }

  const top1 = usable.filter(e => e.urgency_rank_at === 1).length
  const top3 = usable.filter(e => (e.urgency_rank_at ?? 0) <= 3).length
  const meanRank = usable.reduce((sum, e) => sum + (e.urgency_rank_at ?? 0), 0) / usable.length

  const normValues = usable
    .filter(e => (e.ready_count_at ?? 0) > 1)
    .map(e => ((e.urgency_rank_at ?? 1) - 1) / ((e.ready_count_at ?? 2) - 1))

  const meanNorm = normValues.length > 0
    ? normValues.reduce((s, v) => s + v, 0) / normValues.length
    : 0.0

  // surprises: tasks completed from the bottom half of the ready list
  const surprises: unknown[] = []
  for (const e of usable) {
    if ((e.ready_count_at ?? 0) > 1) {
      const normRank = ((e.urgency_rank_at ?? 1) - 1) / ((e.ready_count_at ?? 2) - 1)
      if (normRank > 0.5) {
        const task = svc.store.getTask(e.task_id)
        surprises.push({
          title: task ? task.title : e.task_id,
          rank: e.urgency_rank_at,
          of: e.ready_count_at,
          tags: task ? task.tags : [],
          priority: task ? task.priority : null,
          had_due: task ? task.due != null : null,
        })
        if (surprises.length >= 10) break
      }
    }
  }

  return {
    n: usable.length,
    top1_rate: Math.round(top1 / usable.length * 1000) / 1000,
    top3_rate: Math.round(top3 / usable.length * 1000) / 1000,
    mean_rank: Math.round(meanRank * 100) / 100,
    mean_normalized_rank: Math.round(meanNorm * 1000) / 1000,
    surprises,
  }
}

export async function runTune(
  svc: Service,
  client: Pick<{ generateStructured<T>(prompt: string, schema: ZodType<T>, opts?: { fast?: boolean }): Promise<T> }, 'generateStructured'>,
  coeffs: UrgencyConfig,
): Promise<TuneResult> {
  const calib = buildCalibration(svc)

  const prompt = _PROMPT
    .replace('{coeffs}', JSON.stringify(coeffs, null, 2))
    .replace('{calib}', JSON.stringify(calib, null, 2))

  return client.generateStructured(prompt, tuneResultSchema)
}
