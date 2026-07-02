import { describe, it, expect } from 'vitest'
import { genId, Priority, Status, taskSchema } from '@core/models'

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
