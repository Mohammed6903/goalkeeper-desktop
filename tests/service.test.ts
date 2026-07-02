import { describe, it, expect, beforeEach } from 'vitest'
import { SqliteStore } from '@core/store/sqlite'
import { Service } from '@core/service'
import { defaultUrgencyConfig } from '@core/config'
import { Priority } from '@core/models'

let svc: Service
beforeEach(() => { svc = new Service(new SqliteStore(':memory:'), defaultUrgencyConfig()) })
const NOW = '2026-05-27'

describe('Service', () => {
  it('add/start/complete lifecycle', () => {
    const t = svc.addTask('write tests', {})
    expect(svc.startTask(t.seq)?.status).toBe('active')
    expect(svc.completeTask(t.seq)?.status).toBe('done')
  })
  it('ready excludes blocked tasks', () => {
    const a = svc.addTask('a', {})
    const b = svc.addTask('b', { depends: [a.id] })
    const ready = svc.readyTasks(NOW).map(t => t.id)
    expect(ready).toContain(a.id); expect(ready).not.toContain(b.id)
  })
  it('ready sorted by urgency desc then seq', () => {
    svc.addTask('low', {})
    svc.addTask('high', { priority: Priority.HIGH })
    const ready = svc.readyTasks(NOW)
    expect(ready[0].title).toBe('high')
  })
  it('goal priority inherits into task urgency', () => {
    const g = svc.addGoal('G', { priority: Priority.HIGH })
    const p = svc.addProject('P', { goalId: g.id })
    const t = svc.addTask('t', { projectId: p.id })
    const scored = svc.score(NOW).find(x => x.id === t.id)!
    expect(scored.urgency).toBeGreaterThan(0)
  })
  it('logs an event with rank on create', () => {
    const t = svc.addTask('t', {})
    const evts = svc.store.eventsFor(t.id)
    expect(evts[0].kind).toBe('created')
    expect(evts[0].urgency_rank_at).toBe(1)
  })
  it('complete logs before transition (rank reflects pre-completion)', () => {
    const t = svc.addTask('t', { priority: Priority.HIGH })
    svc.completeTask(t.seq)
    const evts = svc.store.eventsFor(t.id)
    const completed = evts.find(e => e.kind === 'completed')!
    expect(completed.urgency_rank_at).toBe(1)   // was rank 1 in the ready list at completion time
  })
  it('blocking raises urgency of the blocker', () => {
    const a = svc.addTask('a', {})
    svc.addTask('b', { depends: [a.id] })
    const scoredA = svc.score(NOW).find(x => x.id === a.id)!
    expect(scoredA.urgency).toBe(defaultUrgencyConfig().blocking)
  })
})
