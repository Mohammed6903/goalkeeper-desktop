import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SqliteStore } from '@core/store/sqlite'
import { Service } from '@core/service'
import { defaultUrgencyConfig } from '@core/config'

describe('golden parity: TS engine matches Python', () => {
  it('produces identical scores and ready order', () => {
    const svc = new Service(new SqliteStore(':memory:'), defaultUrgencyConfig())
    const g = svc.addGoal('G', { priority: 'high' })
    const p = svc.addProject('P', { goalId: g.id })
    const a = svc.addTask('a', { projectId: p.id, priority: 'medium', due: '2026-05-30' })
    svc.addTask('b', { depends: [a.id] })
    svc.addTask('c', { tags: ['next'] })
    const now = '2026-05-27'
    const tasks: Record<string, number> = {}
    for (const t of svc.score(now)) tasks[String(t.seq)] = t.urgency
    const ready = svc.readyTasks(now).map(t => t.seq)

    const golden = JSON.parse(
      readFileSync(new URL('./parity.golden.json', import.meta.url), 'utf8'),
    )
    expect(tasks).toEqual(golden.tasks)
    expect(ready).toEqual(golden.ready)
  })
})
