/**
 * MongoDB cloud-backup/restore for GoalKeeper Desktop.
 *
 * Format is deliberately compatible with the Python MongoStore so that data
 * written here can be read by the Python CLI and vice-versa:
 *   - Database: "goalkeeper" (configurable)
 *   - Collections: goals / projects / tasks / events
 *   - Each document = entity JSON (snake_case) + `_id` = entity.id
 *
 * The `CloudBackend` interface is the only seam between real Atlas and the
 * in-memory fake used in tests — nothing in this file imports from 'mongodb'
 * directly; the real driver is loaded lazily inside `mongoBackend()` via a
 * dynamic import so test files that only use the fake never trigger driver
 * resolution.
 */

import { goalSchema, projectSchema, taskSchema, eventSchema } from '../models'
import type { SqliteStore } from '../store/sqlite'

// ── Backend seam ──────────────────────────────────────────────────────────────

export interface CloudBackend {
  ping(): Promise<void>
  /** Return all documents in a collection (may include `_id` field). */
  all(collection: string): Promise<any[]>
  /** Upsert documents by `_id`. Each doc must carry `_id`. */
  upsertMany(collection: string, docs: Array<{ _id: string } & Record<string, any>>): Promise<void>
  close(): Promise<void>
}

// ── Real MongoDB backend (lazily-connected) ───────────────────────────────────

/**
 * Create a `CloudBackend` backed by the official `mongodb` Node driver.
 * The driver is imported dynamically so importing this module never fails in
 * environments where the native addon hasn't been resolved (e.g. pure-unit
 * test runs that only exercise the fake backend).
 */
export function mongoBackend(uri: string, dbName = 'goalkeeper'): CloudBackend {
  let clientPromise: Promise<any> | null = null

  async function getDb(): Promise<any> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { MongoClient } = await import('mongodb')
        const client = new MongoClient(uri)
        await client.connect()
        return client
      })()
    }
    const client = await clientPromise
    return client.db(dbName)
  }

  async function getClient(): Promise<any> {
    // Ensures connection is established and returns the raw client
    if (!clientPromise) {
      await getDb()
    }
    return clientPromise
  }

  return {
    async ping(): Promise<void> {
      const db = await getDb()
      await db.command({ ping: 1 })
    },

    async all(collection: string): Promise<any[]> {
      const db = await getDb()
      return db.collection(collection).find({}).toArray()
    },

    async upsertMany(
      collection: string,
      docs: Array<{ _id: string } & Record<string, any>>,
    ): Promise<void> {
      if (docs.length === 0) return
      const db = await getDb()
      const ops = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }))
      await db.collection(collection).bulkWrite(ops)
    },

    async close(): Promise<void> {
      if (clientPromise) {
        const client = await clientPromise
        await client.close()
        clientPromise = null
      }
    },
  }
}

// ── Public result types ───────────────────────────────────────────────────────

export interface BackupResult {
  goals: number
  projects: number
  tasks: number
  events: number
}

export interface RestoreResult {
  goals: number
  projects: number
  tasks: number
  events: number
  skipped: number
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Ping the cloud backend.  Always closes the backend before returning.
 * Returns `true` on success, `false` on any error.
 */
export async function testConnection(backend: CloudBackend): Promise<boolean> {
  try {
    await backend.ping()
    return true
  } catch {
    return false
  } finally {
    await backend.close()
  }
}

/**
 * Push all local data up to the cloud.
 * Each entity is upserted (overwrite-safe) so calling this repeatedly is fine.
 */
export async function backupToCloud(
  store: SqliteStore,
  backend: CloudBackend,
): Promise<BackupResult> {
  try {
    const goals    = store.listGoals()
    const projects = store.listProjects()
    const tasks    = store.listTasks()
    const events   = store.allEvents()

    await backend.upsertMany('goals',    goals.map(g    => ({ ...g,  _id: g.id })))
    await backend.upsertMany('projects', projects.map(p => ({ ...p,  _id: p.id })))
    await backend.upsertMany('tasks',    tasks.map(t    => ({ ...t,  _id: t.id })))
    await backend.upsertMany('events',   events.map(e   => ({ ...e,  _id: e.id })))

    return {
      goals:    goals.length,
      projects: projects.length,
      tasks:    tasks.length,
      events:   events.length,
    }
  } finally {
    await backend.close()
  }
}

/**
 * Pull data from the cloud and merge it into the local store.
 *
 * Strategy (mirrors migrate.ts):
 *   - goals/projects/tasks: if id already exists locally → skip (count as
 *     skipped); otherwise add.
 *   - events: build a Set of existing ids, skip matches.
 *   - After tasks: advance the seq counter to at least the max seq seen, so
 *     that `nextSeq()` never collides with an imported task.
 *   - Order: goals → projects → tasks → events (referential sanity).
 *   - Invalid rows: throw with context rather than silently drop.
 */
export async function restoreFromCloud(
  store: SqliteStore,
  backend: CloudBackend,
): Promise<RestoreResult> {
  const result: RestoreResult = { goals: 0, projects: 0, tasks: 0, events: 0, skipped: 0 }

  try {
    // ── Goals ───────────────────────────────────────────────────────────────
    const rawGoals = await backend.all('goals')
    for (const raw of rawGoals) {
      const { _id, ...doc } = raw
      let goal
      try {
        goal = goalSchema.parse(doc)
      } catch (err) {
        throw new Error(`Cloud restore: invalid goal doc (id=${_id}): ${err}`)
      }
      if (store.getGoal(goal.id)) {
        result.skipped++
        continue
      }
      store.addGoal(goal)
      result.goals++
    }

    // ── Projects ────────────────────────────────────────────────────────────
    const rawProjects = await backend.all('projects')
    for (const raw of rawProjects) {
      const { _id, ...doc } = raw
      let project
      try {
        project = projectSchema.parse(doc)
      } catch (err) {
        throw new Error(`Cloud restore: invalid project doc (id=${_id}): ${err}`)
      }
      if (store.getProject(project.id)) {
        result.skipped++
        continue
      }
      store.addProject(project)
      result.projects++
    }

    // ── Tasks ────────────────────────────────────────────────────────────────
    let maxSeq = 0
    const rawTasks = await backend.all('tasks')
    for (const raw of rawTasks) {
      const { _id, ...doc } = raw
      let task
      try {
        task = taskSchema.parse(doc)
      } catch (err) {
        throw new Error(`Cloud restore: invalid task doc (id=${_id}): ${err}`)
      }
      if (task.seq > maxSeq) maxSeq = task.seq
      if (store.getTask(task.id)) {
        result.skipped++
        continue
      }
      store.addTask(task)
      result.tasks++
    }
    if (maxSeq > 0) {
      store.ensureSeqAtLeast(maxSeq)
    }

    // ── Events ───────────────────────────────────────────────────────────────
    const existingEventIds = new Set(store.allEvents().map(e => e.id))
    const rawEvents = await backend.all('events')
    for (const raw of rawEvents) {
      const { _id, ...doc } = raw
      let event
      try {
        event = eventSchema.parse(doc)
      } catch (err) {
        throw new Error(`Cloud restore: invalid event doc (id=${_id}): ${err}`)
      }
      if (existingEventIds.has(event.id)) {
        result.skipped++
        continue
      }
      store.logEvent(event)
      existingEventIds.add(event.id)
      result.events++
    }
  } finally {
    await backend.close()
  }

  return result
}
