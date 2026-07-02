import { describe, it, expect } from 'vitest'
import { defaultUrgencyConfig } from '@core/config'
import { urgency } from '@core/urgency'
import { taskSchema, Priority, Status, type Task } from '@core/models'

const NOW = '2026-05-27'
const C = defaultUrgencyConfig()
const task = (over: Partial<Task> = {}): Task =>
  taskSchema.parse({ title: 't', created_at: '2026-05-27T00:00:00+00:00', ...over })

describe('urgency', () => {
  // test_empty_task_is_zero
  it('empty task is zero', () => {
    expect(urgency(task(), { now: NOW, coeffs: C })).toBe(0)
  })

  // test_priority_terms
  it('priority terms', () => {
    expect(urgency(task({ priority: Priority.HIGH }), { now: NOW, coeffs: C })).toBe(C.priority_high)
    expect(urgency(task({ priority: Priority.MEDIUM }), { now: NOW, coeffs: C })).toBe(C.priority_medium)
    expect(urgency(task({ priority: Priority.LOW }), { now: NOW, coeffs: C })).toBe(C.priority_low)
  })

  // test_overdue_gets_due_plus_overdue
  it('overdue gets due + overdue', () => {
    expect(urgency(task({ due: '2026-05-20' }), { now: NOW, coeffs: C })).toBe(C.due + C.overdue)
  })

  // test_due_today_counts_as_overdue_boundary
  it('due today is the overdue boundary', () => {
    expect(urgency(task({ due: NOW }), { now: NOW, coeffs: C })).toBe(C.due + C.overdue)
  })

  // test_due_proximity_ramps
  it('due proximity ramps', () => {
    const near = urgency(task({ due: '2026-05-28' }), { now: NOW, coeffs: C })
    const far = urgency(task({ due: '2026-06-05' }), { now: NOW, coeffs: C })
    expect(far).toBeGreaterThan(0)
    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThan(C.due)
  })

  // test_due_beyond_horizon_no_term
  it('due beyond horizon adds nothing', () => {
    expect(urgency(task({ due: '2026-07-01' }), { now: NOW, coeffs: C })).toBe(0)
  })

  // test_age_term_ramps_and_caps
  it('age ramps and caps', () => {
    expect(urgency(task({ created_at: '2026-04-01T00:00:00+00:00' }), { now: NOW, coeffs: C })).toBe(C.age)
  })

  // test_active_boost
  it('active boost', () => {
    expect(urgency(task({ status: Status.ACTIVE }), { now: NOW, coeffs: C })).toBe(C.active)
  })

  // test_blocking_beats_blocked
  it('blocking and blocked terms', () => {
    const blocking = urgency(task(), { now: NOW, coeffs: C, blockingCount: 2 })
    const blocked = urgency(task(), { now: NOW, coeffs: C, isBlocked: true })
    expect(blocking).toBe(C.blocking)
    expect(blocked).toBe(C.blocked)
    expect(blocking).toBeGreaterThan(blocked)
  })

  // test_next_tag_boost
  it('next tag', () => {
    expect(urgency(task({ tags: ['next'] }), { now: NOW, coeffs: C })).toBe(C.tag_next)
  })

  // test_goal_priority_inheritance
  it('goal priority inheritance is fractional', () => {
    const high = urgency(task(), { now: NOW, coeffs: C, goalPriority: Priority.HIGH })
    const low = urgency(task(), { now: NOW, coeffs: C, goalPriority: Priority.LOW })
    expect(high).toBe(Math.round(C.goal_priority * 1.0 * 10000) / 10000)
    expect(low).toBe(Math.round(C.goal_priority * 0.3 * 10000) / 10000)
    expect(high).toBeGreaterThan(low)
  })

  // test_terms_are_additive
  it('terms are additive', () => {
    const t = task({ priority: Priority.HIGH, status: Status.ACTIVE, tags: ['next'] })
    const expected = Math.round((C.priority_high + C.active + C.tag_next) * 10000) / 10000
    expect(urgency(t, { now: NOW, coeffs: C })).toBe(expected)
  })
})

describe('createdDate is wall-clock (timezone-independent)', () => {
  // created 2026-04-01 (>30 days before NOW 2026-05-27) -> age caps at C.age, regardless of offset
  it('naive timestamp', () => {
    expect(urgency(task({ created_at: '2026-04-01T00:00:00' }), { now: NOW, coeffs: C })).toBe(C.age)
  })
  it('positive offset', () => {
    expect(urgency(task({ created_at: '2026-04-01T02:00:00+05:30' }), { now: NOW, coeffs: C })).toBe(C.age)
  })
  it('negative offset near midnight does not shift the date', () => {
    expect(urgency(task({ created_at: '2026-04-01T22:00:00-05:00' }), { now: NOW, coeffs: C })).toBe(C.age)
  })
  it('unparseable created_at contributes no age term', () => {
    expect(urgency(task({ created_at: 'not-a-date' }), { now: NOW, coeffs: C })).toBe(0)
  })
})
