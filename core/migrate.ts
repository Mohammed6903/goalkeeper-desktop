import Database from 'better-sqlite3'
import { goalSchema, projectSchema, taskSchema, eventSchema } from './models'
import type { SqliteStore } from './store/sqlite'

export interface ImportResult {
  goals: number
  projects: number
  tasks: number
  events: number
  skipped: number
}

/**
 * One-time importer: migrates data from a legacy GoalKeeper Python SQLite DB
 * into the new desktop SqliteStore. Safe to run multiple times (idempotent).
 *
 * Legacy schema:
 *   goals    (id TEXT, status TEXT, doc_json TEXT, created_at TEXT)
 *   projects (id TEXT, goal_id TEXT, status TEXT, doc_json TEXT, created_at TEXT)
 *   tasks    (id TEXT, seq INTEGER, project_id TEXT, status TEXT, doc_json TEXT, created_at TEXT)
 *   events   (id TEXT, task_id TEXT, ts TEXT, doc_json TEXT)
 */
export function importLegacy(legacyDbPath: string, store: SqliteStore): ImportResult {
  const legacy = new Database(legacyDbPath, { readonly: true, fileMustExist: true })

  const result: ImportResult = { goals: 0, projects: 0, tasks: 0, events: 0, skipped: 0 }

  try {
    // ── Goals ──────────────────────────────────────────────────────────────
    try {
      const rows = legacy.prepare('SELECT id, doc_json FROM goals').all() as Array<{ id: string; doc_json: string }>
      for (const row of rows) {
        if (store.getGoal(row.id)) {
          result.skipped++
          continue
        }
        const goal = goalSchema.parse(JSON.parse(row.doc_json))
        store.addGoal(goal)
        result.goals++
      }
    } catch (err) {
      if (!isNoTableError(err)) throw err
    }

    // ── Projects ───────────────────────────────────────────────────────────
    try {
      const rows = legacy.prepare('SELECT id, doc_json FROM projects').all() as Array<{ id: string; doc_json: string }>
      for (const row of rows) {
        if (store.getProject(row.id)) {
          result.skipped++
          continue
        }
        const project = projectSchema.parse(JSON.parse(row.doc_json))
        store.addProject(project)
        result.projects++
      }
    } catch (err) {
      if (!isNoTableError(err)) throw err
    }

    // ── Tasks ──────────────────────────────────────────────────────────────
    let maxSeq = 0
    try {
      const rows = legacy.prepare('SELECT id, seq, doc_json FROM tasks').all() as Array<{ id: string; seq: number; doc_json: string }>
      for (const row of rows) {
        if (store.getTask(row.id)) {
          result.skipped++
          if (row.seq > maxSeq) maxSeq = row.seq
          continue
        }
        const task = taskSchema.parse(JSON.parse(row.doc_json))
        store.addTask(task)
        result.tasks++
        if (task.seq > maxSeq) maxSeq = task.seq
      }
    } catch (err) {
      if (!isNoTableError(err)) throw err
    }

    if (maxSeq > 0) {
      store.ensureSeqAtLeast(maxSeq)
    }

    // ── Events ─────────────────────────────────────────────────────────────
    try {
      const existingEventIds = new Set(store.allEvents().map(e => e.id))
      const rows = legacy.prepare('SELECT id, doc_json FROM events').all() as Array<{ id: string; doc_json: string }>
      for (const row of rows) {
        if (existingEventIds.has(row.id)) {
          result.skipped++
          continue
        }
        const event = eventSchema.parse(JSON.parse(row.doc_json))
        store.logEvent(event)
        result.events++
      }
    } catch (err) {
      if (!isNoTableError(err)) throw err
    }
  } finally {
    legacy.close()
  }

  return result
}

/** Returns true if the error is a SQLite "no such table" error. */
function isNoTableError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('no such table')
}
