/**
 * Goal decomposition: turn a goal into a proposed projects+tasks plan (LLM), which the user
 * reviews before it is persisted (deterministic). Advisory only — the persisting happens in
 * the UI (Task 8.4).
 *
 * Ported from GoalKeeper/src/goalkeeper/judgment/decompose.py.
 */

import type { ZodType } from 'zod'
import type { Service } from '@core/service'
import type { Goal } from '@core/models'
import { draftPlanSchema, type DraftPlan } from './schemas'

const _PROMPT = `You are a planning assistant. Break the GOAL below into a concrete set of
projects, each with actionable tasks, that would achieve it.

Rules:
- 1-4 projects; each with 2-8 small, concrete, verifiable tasks.
- Order tasks so prerequisites come first. Use \`depends_on\` with the 1-based task numbers
  (within the same project) that a task must wait on.
- \`due_offset_days\` is days from today; spread work realistically toward the horizon. Leave
  blank if no deadline matters.
- \`priority\` is one of high|medium|low|none. \`estimate_minutes\` is a rough effort guess.
- Be specific to THIS goal; do not invent unrelated work.

GOAL: {title}
DESCRIPTION: {description}
HORIZON: {horizon}
TODAY: {today}
`

export async function runDecompose(
  _svc: Service,
  client: Pick<{ generateStructured<T>(prompt: string, schema: ZodType<T>, opts?: { fast?: boolean }): Promise<T> }, 'generateStructured'>,
  goal: Goal,
): Promise<DraftPlan> {
  const today = new Date().toISOString().slice(0, 10)

  const prompt = _PROMPT
    .replace('{title}', goal.title)
    .replace('{description}', goal.description || '(none)')
    .replace('{horizon}', goal.horizon ?? '(none)')
    .replace('{today}', today)

  return client.generateStructured(prompt, draftPlanSchema)
}
