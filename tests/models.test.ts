import { describe, it, expect } from 'vitest'
import { genId, Priority, Status, taskSchema, goalSchema, projectSchema, eventSchema } from '@core/models'

describe('models', () => {
  it('genId is 8 hex chars', () => { expect(genId()).toMatch(/^[0-9a-f]{8}$/) })
  it('priority enum values', () => { expect(Priority.HIGH).toBe('high') })
  it('task defaults', () => {
    const t = taskSchema.parse({ title: 'x' })
    expect(t.status).toBe(Status.PENDING)
    expect(t.priority).toBe(Priority.NONE)
    expect(t.tags).toEqual([]); expect(t.depends).toEqual([])
    expect(t.urgency).toBe(0); expect(t.seq).toBe(0)
    expect(t.id).toMatch(/^[0-9a-f]{8}$/)
  })
  it('generates a fresh id per parse', () => {
    expect(taskSchema.parse({ title: 'a' }).id).not.toBe(taskSchema.parse({ title: 'b' }).id)
  })
})

describe('other schemas', () => {
  it('goal defaults + fresh id', () => {
    const g = goalSchema.parse({ title: 'g' })
    expect(g.status).toBe('pending'); expect(g.priority).toBe('none')
    expect(g.horizon).toBeNull(); expect(g.description).toBe('')
    expect(g.id).toMatch(/^[0-9a-f]{8}$/)
    expect(goalSchema.parse({ title: 'g' }).id).not.toBe(g.id)
  })
  it('project defaults', () => {
    const p = projectSchema.parse({ title: 'p' })
    expect(p.goal_id).toBeNull(); expect(p.status).toBe('pending')
    expect(p.id).toMatch(/^[0-9a-f]{8}$/)
  })
  it('event defaults + fresh id', () => {
    const e = eventSchema.parse({ task_id: 'abc', kind: 'created' })
    expect(e.urgency_at).toBeNull(); expect(e.urgency_rank_at).toBeNull(); expect(e.ready_count_at).toBeNull()
    expect(e.ts).toContain('T')
    expect(eventSchema.parse({ task_id: 'abc', kind: 'created' }).id).not.toBe(e.id)
  })
})
