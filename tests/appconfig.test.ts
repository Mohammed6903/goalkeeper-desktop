import { describe, it, expect } from 'vitest'
import { ConfigStore } from '@core/config-store'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'

const tmpPath = () => join(tmpdir(), `gk-cfg-${Math.random().toString(36).slice(2)}.json`)

describe('ConfigStore', () => {
  it('returns defaults when the file is missing', () => {
    const c = new ConfigStore(tmpPath())
    const cfg = c.get()
    expect(cfg.urgency.due).toBe(12)
    expect(cfg.gemini.model).toBe('gemini-2.5-pro')
    expect(cfg.gemini.fastModel).toBe('gemini-2.5-flash')
  })

  it('persists coefficient edits across instances', () => {
    const f = tmpPath()
    try {
      const c = new ConfigStore(f)
      const cfg = c.get()
      cfg.urgency.due = 20
      c.save(cfg)
      expect(new ConfigStore(f).get().urgency.due).toBe(20)
    } finally {
      rmSync(f, { force: true })
    }
  })

  it('merges persisted values over defaults (missing fields get defaults)', () => {
    const f = tmpPath()
    try {
      const c = new ConfigStore(f)
      const cfg = c.get()
      cfg.gemini.model = 'gemini-2.5-flash'
      c.save(cfg)
      const reloaded = new ConfigStore(f).get()
      expect(reloaded.gemini.model).toBe('gemini-2.5-flash')
      expect(reloaded.urgency.blocked).toBe(-5) // untouched default preserved
    } finally {
      rmSync(f, { force: true })
    }
  })

  it('falls back to defaults on corrupt JSON', () => {
    const f = tmpPath()
    try {
      writeFileSync(f, '{ not valid json')
      expect(new ConfigStore(f).get().urgency.due).toBe(12)
    } finally {
      rmSync(f, { force: true })
    }
  })
})
