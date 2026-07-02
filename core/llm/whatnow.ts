/**
 * Smart "what now": the LLM reads the ready-task list (+ optional context) and returns an
 * ordered shortlist with reasoning. Read-only — it never mutates state.
 *
 * Ported from GoalKeeper/src/goalkeeper/judgment/whatnow.py.
 */

import type { ZodType } from 'zod'
import type { Service } from '@core/service'
import type { Task } from '@core/models'
import { whatNowResultSchema, type WhatNowResult } from './schemas'

const _PROMPT = `You help decide what to work on RIGHT NOW. Below is the ready-to-work task list
(already filtered to unblocked tasks, with a deterministic urgency score). Pick a short,
ordered shortlist (typically 2-4 tasks) of what to do now and briefly say why for each.

Consider task CONTENT, not just the urgency number: quick unblockers that free up other work,
deadlines, and the user's stated context. You may reorder relative to urgency when the content
justifies it, but don't ignore imminent deadlines.

Refer to tasks by their "seq". Only choose from the seqs provided.

CONTEXT: {context}
READY TASKS (JSON):
{tasks}
`

function serializeTasks(tasks: Task[]): string {
  const rows = tasks.map(t => ({
    seq: t.seq,
    title: t.title,
    urgency: t.urgency,
    due: t.due ?? null,
    priority: t.priority,
    estimate_minutes: t.estimate_minutes,
    tags: t.tags,
  }))
  return JSON.stringify(rows, null, 2)
}

export interface WhatNowInput {
  timeAvailable?: number | null
  energy?: string | null
}

export async function runWhatNow(
  svc: Service,
  client: Pick<{ generateStructured<T>(prompt: string, schema: ZodType<T>, opts?: { fast?: boolean }): Promise<T> }, 'generateStructured'>,
  input: WhatNowInput,
): Promise<WhatNowResult> {
  const ready = svc.readyTasks()

  const ctxBits: string[] = []
  if (input.timeAvailable != null) {
    ctxBits.push(`${input.timeAvailable} minutes available`)
  }
  if (input.energy != null && input.energy !== '') {
    ctxBits.push(`energy: ${input.energy}`)
  }
  const context = ctxBits.length > 0 ? ctxBits.join('; ') : '(none given)'

  const prompt = _PROMPT
    .replace('{context}', context)
    .replace('{tasks}', serializeTasks(ready))

  return client.generateStructured(prompt, whatNowResultSchema, { fast: true })
}
