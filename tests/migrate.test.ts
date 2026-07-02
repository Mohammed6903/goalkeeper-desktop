import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteStore } from '@core/store/sqlite'
import { goalSchema, projectSchema, taskSchema, eventSchema } from '@core/models'
import { importLegacy, type ImportResult } from '@core/migrate'

// ── Legacy DB setup helpers ──────────────────────────────────────────────────

function createLegacyDb(path: string) {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE goals    (id TEXT, status TEXT, doc_json TEXT, created_at TEXT);
    CREATE TABLE projects (id TEXT, goal_id TEXT, status TEXT, doc_json TEXT, created_at TEXT);
    CREATE TABLE tasks    (id TEXT, seq INTEGER, project_id TEXT, status TEXT, doc_json TEXT, created_at TEXT);
    CREATE TABLE events   (id TEXT, task_id TEXT, ts TEXT, doc_json TEXT);
  `)
  return db
}

function insertLegacyGoal(db: Database.Database, goal: ReturnType<typeof goalSchema.parse>) {
  db.prepare('INSERT INTO goals(id, status, doc_json, created_at) VALUES(?, ?, ?, ?)')
    .run(goal.id, goal.status, JSON.stringify(goal), goal.created_at)
}

function insertLegacyProject(db: Database.Database, project: ReturnType<typeof projectSchema.parse>) {
  db.prepare('INSERT INTO projects(id, goal_id, status, doc_json, created_at) VALUES(?, ?, ?, ?, ?)')
    .run(project.id, project.goal_id, project.status, JSON.stringify(project), project.created_at)
}

function insertLegacyTask(db: Database.Database, task: ReturnType<typeof taskSchema.parse>) {
  db.prepare('INSERT INTO tasks(id, seq, project_id, status, doc_json, created_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(task.id, task.seq, task.project_id, task.status, JSON.stringify(task), task.created_at)
}

function insertLegacyEvent(db: Database.Database, event: ReturnType<typeof eventSchema.parse>) {
  db.prepare('INSERT INTO events(id, task_id, ts, doc_json) VALUES(?, ?, ?, ?)')
    .run(event.id, event.task_id, event.ts, JSON.stringify(event))
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const GOAL    = goalSchema.parse({ id: 'goal0001', title: 'Test Goal', status: 'pending' })
const PROJECT = projectSchema.parse({ id: 'proj0001', goal_id: GOAL.id, title: 'Test Project', status: 'pending' })
const TASK    = taskSchema.parse({ id: 'task0001', seq: 42, project_id: PROJECT.id, title: 'Test Task', status: 'pending' })
const EVENT   = eventSchema.parse({ id: 'evnt0001', task_id: TASK.id, kind: 'created' })

// ── Tests ─────────────────────────────────────────────────────────────────────

let tmpDir: string
let legacyPath: string
let store: SqliteStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gk-migrate-test-'))
  legacyPath = join(tmpDir, 'legacy.db')
  store = new SqliteStore(':memory:')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('importLegacy', () => {
  it('imports all entities and returns correct counts', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    const result: ImportResult = importLegacy(legacyPath, store)

    expect(result.goals).toBe(1)
    expect(result.projects).toBe(1)
    expect(result.tasks).toBe(1)
    expect(result.events).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('lands entities with correct ids', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    importLegacy(legacyPath, store)

    expect(store.getGoal(GOAL.id)?.id).toBe(GOAL.id)
    expect(store.getProject(PROJECT.id)?.id).toBe(PROJECT.id)
    // task retrieved by seq preserves original seq and id
    const importedTask = store.getTask(TASK.seq)
    expect(importedTask?.id).toBe(TASK.id)
    expect(importedTask?.seq).toBe(42)
  })

  it('imports events correctly', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    importLegacy(legacyPath, store)

    const events = store.allEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe(EVENT.id)
    expect(events[0].task_id).toBe(TASK.id)
  })

  it('is idempotent: second run skips all existing entities', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    importLegacy(legacyPath, store)
    const second: ImportResult = importLegacy(legacyPath, store)

    expect(second.goals).toBe(0)
    expect(second.projects).toBe(0)
    expect(second.tasks).toBe(0)
    expect(second.events).toBe(0)
    expect(second.skipped).toBe(4) // 1 goal + 1 project + 1 task + 1 event
  })

  it('does not duplicate entities on second run', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    importLegacy(legacyPath, store)
    importLegacy(legacyPath, store)

    expect(store.listGoals()).toHaveLength(1)
    expect(store.listProjects()).toHaveLength(1)
    expect(store.listTasks()).toHaveLength(1)
    expect(store.allEvents()).toHaveLength(1)
  })

  it('advances seq counter so nextSeq() returns maxImportedSeq + 1', () => {
    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK) // seq = 42
    insertLegacyEvent(legacy, EVENT)
    legacy.close()

    importLegacy(legacyPath, store)

    expect(store.nextSeq()).toBe(43) // 42 + 1
  })

  it('handles legacy DB with missing tables gracefully', () => {
    // Create a DB with only the goals table (simulating an older schema)
    const db = new Database(legacyPath)
    db.exec('CREATE TABLE goals (id TEXT, status TEXT, doc_json TEXT, created_at TEXT);')
    insertLegacyGoal(db, GOAL)
    db.close()

    const result: ImportResult = importLegacy(legacyPath, store)

    // goals should import, other tables should be skipped gracefully
    expect(result.goals).toBe(1)
    expect(result.projects).toBe(0)
    expect(result.tasks).toBe(0)
    expect(result.events).toBe(0)
    expect(result.skipped).toBe(0)
    expect(store.getGoal(GOAL.id)?.id).toBe(GOAL.id)
  })

  it('handles multiple tasks and advances counter to max seq', () => {
    const TASK2 = taskSchema.parse({ id: 'task0002', seq: 100, project_id: PROJECT.id, title: 'Task 2', status: 'pending' })
    const TASK3 = taskSchema.parse({ id: 'task0003', seq: 7,   project_id: PROJECT.id, title: 'Task 3', status: 'active' })

    const legacy = createLegacyDb(legacyPath)
    insertLegacyGoal(legacy, GOAL)
    insertLegacyProject(legacy, PROJECT)
    insertLegacyTask(legacy, TASK)   // seq 42
    insertLegacyTask(legacy, TASK2)  // seq 100 (max)
    insertLegacyTask(legacy, TASK3)  // seq 7
    legacy.close()

    importLegacy(legacyPath, store)

    expect(store.nextSeq()).toBe(101) // max(42, 100, 7) + 1
    expect(store.listTasks()).toHaveLength(3)
  })

  it('throws on file not found', () => {
    expect(() => importLegacy('/nonexistent/path/to.db', store)).toThrow()
  })
})
