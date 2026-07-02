import { describe, it, expect } from 'vitest'
import { num, asInt, coercePriority, draftPlanSchema, whatNowResultSchema, groomResultSchema, tuneResultSchema } from '@core/llm/schemas'

describe('coercers', () => {
  it('num', () => {
    expect(num('7')).toBe(7); expect(num('3.5')).toBe(3.5)
    expect(num('')).toBeNull(); expect(num('  ')).toBeNull(); expect(num('abc')).toBeNull()
  })
  it('asInt', () => {
    expect(asInt('7')).toBe(7); expect(asInt('7.9')).toBe(7); expect(asInt('')).toBeNull(); expect(asInt('x')).toBeNull()
  })
  it('coercePriority', () => {
    expect(coercePriority('HIGH')).toBe('high'); expect(coercePriority('medium')).toBe('medium')
    expect(coercePriority('bogus')).toBe('none'); expect(coercePriority('')).toBe('none')
  })
})

describe('draft schemas parse model-shaped (all-string) payloads', () => {
  it('draftPlan', () => {
    const p = draftPlanSchema.parse({ projects: [{ title: 'P', description: '', tasks: [
      { title: 'a', description: '', priority: 'high', due_offset_days: '3', estimate_minutes: '30', tags: ['x'], depends_on: ['1'] },
    ] }] })
    expect(p.projects[0].tasks[0].title).toBe('a')
  })
  it('whatNowResult', () => {
    const r = whatNowResultSchema.parse({ summary: 's', shortlist: [{ ref: '5', reason: 'r' }] })
    expect(r.shortlist[0].ref).toBe('5')
  })
  it('groomResult', () => {
    const r = groomResultSchema.parse({ ops: [{ op: 'set_priority', task_ref: '3', detail: 'd', value: 'high', subtasks: [], merge_into: '' }] })
    expect(r.ops[0].op).toBe('set_priority')
  })
  it('tuneResult', () => {
    const r = tuneResultSchema.parse({ summary: 's', deltas: [{ name: 'due', new_value: '15', reason: 'r' }] })
    expect(r.deltas[0].name).toBe('due')
  })
})
