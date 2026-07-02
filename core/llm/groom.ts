/**
 * Backlog groomer: the LLM reviews open tasks and proposes concrete change-ops
 * (split / set-deadline / set-priority / add-tag / merge-duplicate / mark-stale). Advisory
 * only — the applying happens in the UI (Task 8.4).
 *
 * Ported from GoalKeeper/src/goalkeeper/judgment/groom.py.
 */

import type { ZodType } from 'zod'
import type { Service } from '@core/service'
import type { Task } from '@core/models'
import { Status } from '@core/models'
import { groomResultSchema, type GroomResult } from './schemas'

const _PROMPT = `You are grooming a personal task backlog. Review the OPEN TASKS (JSON) and
propose concrete fixes. Only propose changes that clearly improve the backlog; it is fine to
return few or no ops.

Allowed ops (use the task "seq" for task_ref):
- "split": a task too big/vague to action. Provide \`subtasks\` (2-5 concrete titles). The
  original task will be replaced by these subtasks.
- "set_deadline": a task that clearly needs a due date. \`value\` = YYYY-MM-DD.
- "set_priority": \`value\` = high|medium|low|none.
- "add_tag": \`value\` = a single tag (e.g. "next" for the immediate next action).
- "merge_duplicate": two tasks are duplicates. \`task_ref\` = the one to remove,
  \`merge_into\` = the seq to keep.
- "mark_stale": a task that looks abandoned/irrelevant (will be tagged "stale" for review).

Always include a short \`detail\` explaining why.

TODAY: {today}
OPEN TASKS (JSON):
{tasks}
`

function ageDays(t: Task): number | null {
  try {
    const created = new Date(t.created_at)
    const today = new Date()
    const diff = today.getTime() - created.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

function serializeTasks(tasks: Task[]): string {
  const rows = tasks.map(t => ({
    seq: t.seq,
    title: t.title,
    description: t.description,
    priority: t.priority,
    due: t.due ?? null,
    tags: t.tags,
    status: t.status,
    age_days: ageDays(t),
  }))
  return JSON.stringify(rows, null, 2)
}

export async function runGroom(
  svc: Service,
  client: Pick<{ generateStructured<T>(prompt: string, schema: ZodType<T>, opts?: { fast?: boolean }): Promise<T> }, 'generateStructured'>,
): Promise<GroomResult> {
  const openTasks = svc.listTasks().filter(t => t.status !== Status.DONE)

  const today = new Date().toISOString().slice(0, 10)
  const prompt = _PROMPT
    .replace('{today}', today)
    .replace('{tasks}', serializeTasks(openTasks))

  return client.generateStructured(prompt, groomResultSchema)
}
