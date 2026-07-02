import { describe, it, expect, beforeEach } from 'vitest'
import { SqliteStore } from '@core/store/sqlite'
import { goalSchema, projectSchema, taskSchema, eventSchema } from '@core/models'

let s: SqliteStore
beforeEach(() => { s = new SqliteStore(':memory:') })

describe('SqliteStore', () => {
  it('round-trips a goal', () => {
    const g = s.addGoal(goalSchema.parse({ title: 'G' }))
    expect(s.getGoal(g.id)?.title).toBe('G')
    expect(s.listGoals()).toHaveLength(1)
  })
  it('nextSeq increments', () => {
    expect(s.nextSeq()).toBe(1); expect(s.nextSeq()).toBe(2)
  })
  it('task seq + lookup by seq and id', () => {
    const t = s.addTask(taskSchema.parse({ title: 'T', seq: s.nextSeq() }))
    expect(s.getTask(t.seq)?.id).toBe(t.id)
    expect(s.getTask(t.id)?.seq).toBe(t.seq)
  })
  it('list tasks filters by project and status', () => {
    const p = s.addProject(projectSchema.parse({ title: 'P' }))
    s.addTask(taskSchema.parse({ title: 'a', project_id: p.id, seq: s.nextSeq() }))
    s.addTask(taskSchema.parse({ title: 'b', seq: s.nextSeq() }))
    expect(s.listTasks(p.id)).toHaveLength(1)
    expect(s.listTasks(null, 'pending')).toHaveLength(2)
  })
  it('delete removes rows', () => {
    const t = s.addTask(taskSchema.parse({ title: 'x', seq: s.nextSeq() }))
    s.deleteTask(t.id); expect(s.getTask(t.id)).toBeNull()
  })
  it('update persists changes', () => {
    const t = s.addTask(taskSchema.parse({ title: 'x', seq: s.nextSeq() }))
    t.status = 'done'; s.updateTask(t)
    expect(s.getTask(t.id)?.status).toBe('done')
    expect(s.listTasks(null, 'done')).toHaveLength(1)
  })
  it('events append and query', () => {
    s.logEvent(eventSchema.parse({ task_id: 'abc', kind: 'created' }))
    s.logEvent(eventSchema.parse({ task_id: 'xyz', kind: 'started' }))
    expect(s.allEvents()).toHaveLength(2)
    expect(s.eventsFor('abc')).toHaveLength(1)
  })
  it('goal/project round-trip and delete', () => {
    const g = s.addGoal(goalSchema.parse({ title: 'G' }))
    const p = s.addProject(projectSchema.parse({ title: 'P', goal_id: g.id }))
    expect(s.listProjects(g.id)).toHaveLength(1)
    s.deleteProject(p.id); expect(s.getProject(p.id)).toBeNull()
    s.deleteGoal(g.id); expect(s.getGoal(g.id)).toBeNull()
  })
})
