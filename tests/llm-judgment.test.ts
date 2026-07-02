import { describe, it, expect } from 'vitest'
import { SqliteStore } from '@core/store/sqlite'
import { Service } from '@core/service'
import { defaultUrgencyConfig } from '@core/config'
import { runWhatNow } from '@core/llm/whatnow'
import { runGroom } from '@core/llm/groom'
import { runTune } from '@core/llm/tune'
import { runDecompose } from '@core/llm/decompose'

function svcWith() {
  const s = new Service(new SqliteStore(':memory:'), defaultUrgencyConfig())
  const g = s.addGoal('G', { priority: 'high' }); const p = s.addProject('P', { goalId: g.id })
  s.addTask('a', { projectId: p.id, priority: 'high' }); s.addTask('b', {})
  return { s, g }
}
const mock = (payload: any) => ({ generateStructured: async (_p: string, schema: any) => schema.parse(payload) })

describe('judgment wiring', () => {
  it('whatnow returns parsed shortlist and included ready tasks in the prompt', async () => {
    const { s } = svcWith()
    let seen = ''
    const client = { generateStructured: async (p: string, schema: any) => { seen = p; return schema.parse({ summary: 's', shortlist: [{ ref: '1', reason: 'r' }] }) } }
    const r = await runWhatNow(s, client, { timeAvailable: 25, energy: 'medium' })
    expect(r.shortlist[0].ref).toBe('1')
    expect(seen).toContain('25'); expect(seen.toLowerCase()).toContain('medium') // time/energy in prompt
  })
  it('groom returns ops', async () => {
    const { s } = svcWith()
    const r = await runGroom(s, mock({ ops: [{ op: 'mark_stale', task_ref: '2', detail: 'd', value: '', subtasks: [], merge_into: '' }] }))
    expect(r.ops[0].op).toBe('mark_stale')
  })
  it('tune returns deltas', async () => {
    const { s } = svcWith()
    const r = await runTune(s, mock({ summary: 's', deltas: [{ name: 'due', new_value: '15', reason: 'r' }] }), defaultUrgencyConfig())
    expect(r.deltas[0].name).toBe('due')
  })
  it('decompose returns a plan', async () => {
    const { s, g } = svcWith()
    const r = await runDecompose(s, mock({ projects: [{ title: 'P', description: '', tasks: [] }] }), g)
    expect(r.projects[0].title).toBe('P')
  })
})
