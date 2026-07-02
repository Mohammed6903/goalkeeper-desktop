/**
 * Tests for core/cloud/mongo-backup.ts
 *
 * All tests use an in-memory CloudBackend fake — no real MongoDB / Atlas
 * connection is made at any point.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SqliteStore } from '@core/store/sqlite'
import { Service } from '@core/service'
import { defaultUrgencyConfig } from '@core/config'
import { goalSchema, projectSchema, taskSchema, eventSchema } from '@core/models'
import type { CloudBackend } from '@core/cloud/mongo-backup'
import {
  testConnection,
  backupToCloud,
  restoreFromCloud,
} from '@core/cloud/mongo-backup'

// ── In-memory CloudBackend fake ───────────────────────────────────────────────

/**
 * A Map-based in-memory fake.  Each collection is a Map from _id → document.
 * Supports an optional `failPing` flag to test `testConnection` failure path.
 */
function makeFakeBackend(opts: { failPing?: boolean } = {}): CloudBackend & {
  store: Map<string, Map<string, any>>
  closed: boolean
} {
  const store = new Map<string, Map<string, any>>()

  function coll(name: string): Map<string, any> {
    if (!store.has(name)) store.set(name, new Map())
    return store.get(name)!
  }

  return {
    store,
    closed: false,

    async ping(): Promise<void> {
      if (opts.failPing) throw new Error('connection refused')
    },

    async all(collection: string): Promise<any[]> {
      return Array.from(coll(collection).values())
    },

    async upsertMany(
      collection: string,
      docs: Array<{ _id: string } & Record<string, any>>,
    ): Promise<void> {
      const c = coll(collection)
      for (const doc of docs) c.set(doc._id, { ...doc })
    },

    async close(): Promise<void> {
      this.closed = true
    },
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GOAL = goalSchema.parse({
  id: 'goal0001',
  title: 'Test Goal',
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
})
const PROJECT = projectSchema.parse({
  id: 'proj0001',
  goal_id: GOAL.id,
  title: 'Test Project',
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
})
const TASK = taskSchema.parse({
  id: 'task0001',
  seq: 42,
  project_id: PROJECT.id,
  title: 'Test Task',
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
})
const TASK2 = taskSchema.parse({
  id: 'task0002',
  seq: 99,
  project_id: PROJECT.id,
  title: 'Test Task 2',
  status: 'active',
  created_at: '2026-01-02T00:00:00.000Z',
})
const EVENT = eventSchema.parse({
  id: 'evnt0001',
  task_id: TASK.id,
  kind: 'created',
  ts: '2026-01-01T00:00:00.000Z',
})

// ── Helper: seed a SqliteStore using the Service ───────────────────────────────

function seedStore(): SqliteStore {
  const store = new SqliteStore(':memory:')
  const svc = new Service(store, defaultUrgencyConfig())
  svc.addGoal(GOAL.title, { priority: GOAL.priority })
  // We re-use fixed fixtures rather than Service-generated ids, so we add them
  // directly via the store to keep ids deterministic.
  store.addGoal(GOAL)          // duplicate-safe — but we want the exact fixture
  store.addProject(PROJECT)
  store.addTask(TASK)
  store.addTask(TASK2)
  store.logEvent(EVENT)
  return store
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('testConnection', () => {
  it('returns true when ping succeeds', async () => {
    const backend = makeFakeBackend()
    expect(await testConnection(backend)).toBe(true)
    expect(backend.closed).toBe(true)
  })

  it('returns false when ping rejects', async () => {
    const backend = makeFakeBackend({ failPing: true })
    expect(await testConnection(backend)).toBe(false)
    expect(backend.closed).toBe(true)
  })

  it('always closes the backend even after failure', async () => {
    const backend = makeFakeBackend({ failPing: true })
    await testConnection(backend)
    expect(backend.closed).toBe(true)
  })
})

describe('backupToCloud', () => {
  let sourceStore: SqliteStore
  let backend: ReturnType<typeof makeFakeBackend>

  beforeEach(() => {
    // Build a fresh store with known fixtures
    sourceStore = new SqliteStore(':memory:')
    sourceStore.addGoal(GOAL)
    sourceStore.addProject(PROJECT)
    sourceStore.addTask(TASK)
    sourceStore.addTask(TASK2)
    sourceStore.logEvent(EVENT)
    sourceStore.ensureSeqAtLeast(99)

    backend = makeFakeBackend()
  })

  it('returns correct entity counts', async () => {
    const result = await backupToCloud(sourceStore, backend)
    expect(result.goals).toBe(1)
    expect(result.projects).toBe(1)
    expect(result.tasks).toBe(2)
    expect(result.events).toBe(1)
  })

  it('uploads goals with _id = entity.id', async () => {
    await backupToCloud(sourceStore, backend)
    const goalDocs = await backend.store.get('goals')!
    expect(goalDocs.has(GOAL.id)).toBe(true)
    const doc = goalDocs.get(GOAL.id)
    expect(doc._id).toBe(GOAL.id)
    expect(doc.id).toBe(GOAL.id)
    expect(doc.title).toBe(GOAL.title)
  })

  it('uploads projects with correct fields', async () => {
    await backupToCloud(sourceStore, backend)
    const projDocs = backend.store.get('projects')!
    expect(projDocs.has(PROJECT.id)).toBe(true)
    const doc = projDocs.get(PROJECT.id)
    expect(doc._id).toBe(PROJECT.id)
    expect(doc.goal_id).toBe(GOAL.id)
  })

  it('uploads tasks with correct seq', async () => {
    await backupToCloud(sourceStore, backend)
    const taskDocs = backend.store.get('tasks')!
    expect(taskDocs.size).toBe(2)
    const t1 = taskDocs.get(TASK.id)
    const t2 = taskDocs.get(TASK2.id)
    expect(t1.seq).toBe(42)
    expect(t2.seq).toBe(99)
  })

  it('uploads events with correct task_id', async () => {
    await backupToCloud(sourceStore, backend)
    const evtDocs = backend.store.get('events')!
    expect(evtDocs.has(EVENT.id)).toBe(true)
    const doc = evtDocs.get(EVENT.id)
    expect(doc.task_id).toBe(TASK.id)
    expect(doc.kind).toBe('created')
  })

  it('closes the backend after upload', async () => {
    await backupToCloud(sourceStore, backend)
    expect(backend.closed).toBe(true)
  })

  it('is idempotent: re-running backup does not throw', async () => {
    const backend2 = makeFakeBackend()
    await backupToCloud(sourceStore, backend2)
    // Pre-seed a second fresh backend with the same data then run again
    const backend3 = makeFakeBackend()
    await backupToCloud(sourceStore, backend3)
    // Both should hold the same docs — upsert semantics
    expect(backend3.store.get('goals')!.size).toBe(1)
    expect(backend3.store.get('tasks')!.size).toBe(2)
  })
})

describe('restoreFromCloud', () => {
  let backend: ReturnType<typeof makeFakeBackend>

  beforeEach(async () => {
    // Seed backend by running a backup from a known source store
    const sourceStore = new SqliteStore(':memory:')
    sourceStore.addGoal(GOAL)
    sourceStore.addProject(PROJECT)
    sourceStore.addTask(TASK)
    sourceStore.addTask(TASK2)
    sourceStore.logEvent(EVENT)
    sourceStore.ensureSeqAtLeast(99)

    const backupBackend = makeFakeBackend()
    await backupToCloud(sourceStore, backupBackend)
    // Re-open: create a new fake seeded from the same data
    backend = makeFakeBackend()
    backend.store.set('goals',    backupBackend.store.get('goals')!)
    backend.store.set('projects', backupBackend.store.get('projects')!)
    backend.store.set('tasks',    backupBackend.store.get('tasks')!)
    backend.store.set('events',   backupBackend.store.get('events')!)
  })

  it('restores all entities into a fresh store', async () => {
    const freshStore = new SqliteStore(':memory:')
    const result = await restoreFromCloud(freshStore, backend)

    expect(result.goals).toBe(1)
    expect(result.projects).toBe(1)
    expect(result.tasks).toBe(2)
    expect(result.events).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('entity ids match originals after restore', async () => {
    const freshStore = new SqliteStore(':memory:')
    await restoreFromCloud(freshStore, backend)

    expect(freshStore.getGoal(GOAL.id)?.id).toBe(GOAL.id)
    expect(freshStore.getProject(PROJECT.id)?.id).toBe(PROJECT.id)
    expect(freshStore.getTask(TASK.id)?.id).toBe(TASK.id)
    expect(freshStore.getTask(TASK2.id)?.id).toBe(TASK2.id)
  })

  it('task seq values are preserved', async () => {
    const freshStore = new SqliteStore(':memory:')
    await restoreFromCloud(freshStore, backend)

    expect(freshStore.getTask(TASK.id)?.seq).toBe(42)
    expect(freshStore.getTask(TASK2.id)?.seq).toBe(99)
  })

  it('advances nextSeq past the max imported seq', async () => {
    const freshStore = new SqliteStore(':memory:')
    await restoreFromCloud(freshStore, backend)

    // Max seq is 99; nextSeq() should return 100
    expect(freshStore.nextSeq()).toBe(100)
  })

  it('restores events correctly', async () => {
    const freshStore = new SqliteStore(':memory:')
    await restoreFromCloud(freshStore, backend)

    const events = freshStore.allEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe(EVENT.id)
    expect(events[0].task_id).toBe(TASK.id)
    expect(events[0].kind).toBe('created')
  })

  it('is idempotent: second restore reports all skipped, no duplicates', async () => {
    const freshStore = new SqliteStore(':memory:')

    // Fresh backend clone for second restore (backend.close() was called by first)
    const backend2 = makeFakeBackend()
    backend2.store.set('goals',    backend.store.get('goals')!)
    backend2.store.set('projects', backend.store.get('projects')!)
    backend2.store.set('tasks',    backend.store.get('tasks')!)
    backend2.store.set('events',   backend.store.get('events')!)

    await restoreFromCloud(freshStore, backend)

    // Second restore with same data
    const backend3 = makeFakeBackend()
    backend3.store.set('goals',    backend2.store.get('goals')!)
    backend3.store.set('projects', backend2.store.get('projects')!)
    backend3.store.set('tasks',    backend2.store.get('tasks')!)
    backend3.store.set('events',   backend2.store.get('events')!)

    const second = await restoreFromCloud(freshStore, backend3)

    expect(second.goals).toBe(0)
    expect(second.projects).toBe(0)
    expect(second.tasks).toBe(0)
    expect(second.events).toBe(0)
    expect(second.skipped).toBe(5) // 1 goal + 1 project + 2 tasks + 1 event

    // No duplicates
    expect(freshStore.listGoals()).toHaveLength(1)
    expect(freshStore.listProjects()).toHaveLength(1)
    expect(freshStore.listTasks()).toHaveLength(2)
    expect(freshStore.allEvents()).toHaveLength(1)
  })

  it('closes the backend after restore', async () => {
    const freshStore = new SqliteStore(':memory:')
    await restoreFromCloud(freshStore, backend)
    expect(backend.closed).toBe(true)
  })

  it('strips _id before zod validation (no extra field errors)', async () => {
    // This test verifies that _id does not leak into the zod parse call,
    // which would cause strict-mode schemas to reject the document.
    const freshStore = new SqliteStore(':memory:')
    // Should not throw
    await expect(restoreFromCloud(freshStore, backend)).resolves.not.toThrow()
  })

  it('throws a descriptive error when a cloud document is invalid', async () => {
    const corruptBackend = makeFakeBackend()
    corruptBackend.store.set('goals', new Map([
      ['bad-id', { _id: 'bad-id', /* title is required but missing */ status: 'pending' }],
    ]))
    corruptBackend.store.set('projects', new Map())
    corruptBackend.store.set('tasks',    new Map())
    corruptBackend.store.set('events',   new Map())

    const freshStore = new SqliteStore(':memory:')
    await expect(restoreFromCloud(freshStore, corruptBackend)).rejects.toThrow(
      /Cloud restore: invalid goal doc/,
    )
  })
})

describe('backup → restore round-trip', () => {
  it('full round-trip: backup then restore into empty store matches original', async () => {
    const source = new SqliteStore(':memory:')
    source.addGoal(GOAL)
    source.addProject(PROJECT)
    source.addTask(TASK)
    source.addTask(TASK2)
    source.logEvent(EVENT)
    source.ensureSeqAtLeast(99)

    const backend = makeFakeBackend()
    const backupResult = await backupToCloud(source, backend)

    // backend is now "closed" from the backup — create a view from its data
    const restoreBackend = makeFakeBackend()
    // The fake's store maps are still populated (close() is a no-op for the fake)
    restoreBackend.store.set('goals',    backend.store.get('goals')!)
    restoreBackend.store.set('projects', backend.store.get('projects')!)
    restoreBackend.store.set('tasks',    backend.store.get('tasks')!)
    restoreBackend.store.set('events',   backend.store.get('events')!)

    const dest = new SqliteStore(':memory:')
    const restoreResult = await restoreFromCloud(dest, restoreBackend)

    // Counts match
    expect(restoreResult.goals).toBe(backupResult.goals)
    expect(restoreResult.projects).toBe(backupResult.projects)
    expect(restoreResult.tasks).toBe(backupResult.tasks)
    expect(restoreResult.events).toBe(backupResult.events)
    expect(restoreResult.skipped).toBe(0)

    // Data fidelity
    expect(dest.getGoal(GOAL.id)?.title).toBe(GOAL.title)
    expect(dest.getProject(PROJECT.id)?.title).toBe(PROJECT.title)
    expect(dest.getTask(TASK.id)?.seq).toBe(42)
    expect(dest.getTask(TASK2.id)?.seq).toBe(99)
    expect(dest.allEvents()[0].kind).toBe('created')

    // Seq counter advanced
    expect(dest.nextSeq()).toBe(100)
  })
})
