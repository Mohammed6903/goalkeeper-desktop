/**
 * Deterministic orchestration over the store + urgency engine.
 *
 * Ported 1:1 from GoalKeeper's Python `service.py`. This is the only layer that
 * mutates state. It resolves the dependency graph and goal-priority inheritance
 * needed to score urgency, maintains the ready-list, and logs an Event (with the
 * task's urgency rank at that moment) on create / start / complete / modify.
 *
 * Critical parity points:
 * - `score()`: open-task index (not-done), blocking_count[dep] += 1 for each open
 *   dependent, is_blocked = task has any open dep, goal-priority via project→goal cache.
 * - `readyTasks()`: scored, filter not-blocked, sort (-urgency, seq).
 * - `_log()`: rank from readyTasks AT THAT MOMENT (1-based, null if absent).
 * - `completeTask()`: logs BEFORE status transition (rank reflects pre-completion state).
 * - `startTask()`: sets status+started_at then logs.
 */

import type { UrgencyConfig } from './config'
import type { Store } from './store/index'
import { urgency } from './urgency'
import {
  goalSchema, projectSchema, taskSchema, eventSchema, nowIso,
  Priority, Status, type Goal, type Project, type Task,
} from './models'

export class Service {
  constructor(public store: Store, private coeffs: UrgencyConfig) {}

  // ── Goals ────────────────────────────────────────────────────────────────

  addGoal(
    title: string,
    o: { description?: string; priority?: string; horizon?: string | null } = {},
  ): Goal {
    return this.store.addGoal(goalSchema.parse({
      title,
      description: o.description ?? '',
      priority: o.priority ?? Priority.NONE,
      horizon: o.horizon ?? null,
    }))
  }

  completeGoal(id: string): Goal | null {
    const g = this.store.getGoal(id)
    if (g) { g.status = Status.DONE; this.store.updateGoal(g) }
    return g
  }

  listGoals(): Goal[] { return this.store.listGoals() }
  getGoal(id: string): Goal | null { return this.store.getGoal(id) }
  deleteGoal(id: string): void { this.store.deleteGoal(id) }

  // ── Projects ──────────────────────────────────────────────────────────────

  addProject(
    title: string,
    o: { goalId?: string | null; description?: string } = {},
  ): Project {
    return this.store.addProject(projectSchema.parse({
      title,
      goal_id: o.goalId ?? null,
      description: o.description ?? '',
    }))
  }

  completeProject(id: string): Project | null {
    const p = this.store.getProject(id)
    if (p) { p.status = Status.DONE; this.store.updateProject(p) }
    return p
  }

  listProjects(goalId?: string | null): Project[] { return this.store.listProjects(goalId) }
  getProject(id: string): Project | null { return this.store.getProject(id) }
  deleteProject(id: string): void { this.store.deleteProject(id) }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  addTask(
    title: string,
    o: {
      projectId?: string | null
      priority?: string
      due?: string | null
      estimateMinutes?: number | null
      tags?: string[]
      depends?: string[]
    } = {},
    now?: string,
  ): Task {
    const t = this.store.addTask(taskSchema.parse({
      title,
      seq: this.store.nextSeq(),
      project_id: o.projectId ?? null,
      priority: o.priority ?? Priority.NONE,
      due: o.due ?? null,
      estimate_minutes: o.estimateMinutes ?? null,
      tags: o.tags ?? [],
      depends: o.depends ?? [],
    }))
    this._log(t, 'created', now)
    return t
  }

  startTask(idOrSeq: string | number, now?: string): Task | null {
    const t = this.store.getTask(idOrSeq)
    if (!t) return null
    t.status = Status.ACTIVE
    t.started_at = nowIso()
    this.store.updateTask(t)
    this._log(t, 'started', now)
    return t
  }

  completeTask(idOrSeq: string | number, now?: string): Task | null {
    const t = this.store.getTask(idOrSeq)
    if (!t) return null
    // Log BEFORE transition so rank reflects the pre-completion ready-list state
    this._log(t, 'completed', now)
    t.status = Status.DONE
    t.completed_at = nowIso()
    this.store.updateTask(t)
    return t
  }

  modifyTask(t: Task, now?: string): Task {
    this.store.updateTask(t)
    this._log(t, 'modified', now)
    return t
  }

  getTask(idOrSeq: string | number): Task | null { return this.store.getTask(idOrSeq) }
  deleteTask(id: string): void { this.store.deleteTask(id) }
  listTasks(projectId?: string | null, status?: string | null): Task[] {
    return this.store.listTasks(projectId, status)
  }

  // ── Urgency / ready-list ──────────────────────────────────────────────────

  /** Map of all not-done tasks by id (for graph resolution). */
  private openIndex(): Map<string, Task> {
    return new Map(
      this.store.listTasks().filter(t => t.status !== Status.DONE).map(t => [t.id, t]),
    )
  }

  /**
   * Resolve the goal priority for a task via project→goal cache chain.
   * Mirrors Python's `_goal_priority_for`.
   */
  private goalPriorityFor(
    t: Task,
    pc: Map<string, Project | null>,
    gc: Map<string, Goal | null>,
  ): string {
    if (!t.project_id) return Priority.NONE
    if (!pc.has(t.project_id)) pc.set(t.project_id, this.store.getProject(t.project_id))
    const proj = pc.get(t.project_id)
    if (!proj || !proj.goal_id) return Priority.NONE
    if (!gc.has(proj.goal_id)) gc.set(proj.goal_id, this.store.getGoal(proj.goal_id))
    return gc.get(proj.goal_id)?.priority ?? Priority.NONE
  }

  /**
   * Return every not-done task with its `urgency` field freshly computed.
   * Mirrors Python's `score()`.
   */
  score(now?: string): Task[] {
    const n = now ?? new Date().toISOString().slice(0, 10)
    const open = this.openIndex()

    // blocking_count[tid] = number of open tasks that depend on tid
    const blocking = new Map<string, number>([...open.keys()].map(k => [k, 0]))
    for (const t of open.values()) {
      for (const dep of t.depends) {
        if (open.has(dep)) {
          // dep is still open → dep blocks t; dep's blocking_count rises
          blocking.set(dep, (blocking.get(dep) ?? 0) + 1)
        }
      }
    }

    const pc = new Map<string, Project | null>()
    const gc = new Map<string, Goal | null>()
    const out: Task[] = []

    for (const t of open.values()) {
      const isBlocked = t.depends.some(d => open.has(d))
      t.urgency = urgency(t, {
        now: n,
        coeffs: this.coeffs,
        blockingCount: blocking.get(t.id) ?? 0,
        isBlocked,
        goalPriority: this.goalPriorityFor(t, pc, gc),
      })
      out.push(t)
    }

    return out
  }

  /**
   * Not-done, not-blocked tasks sorted by urgency desc (seq tie-break).
   * Mirrors Python's `ready_tasks()`.
   */
  readyTasks(now?: string): Task[] {
    const n = now ?? new Date().toISOString().slice(0, 10)
    const open = this.openIndex()
    return this.score(n)
      .filter(t => !t.depends.some(d => open.has(d)))
      .sort((a, b) => (b.urgency - a.urgency) || (a.seq - b.seq))
  }

  /**
   * Record an event capturing the task's rank in the ready-list at this moment.
   * Mirrors Python's `_log()`.
   */
  private _log(
    task: Task,
    kind: 'created' | 'started' | 'completed' | 'modified',
    now?: string,
  ): void {
    const ready = this.readyTasks(now)
    const idx = ready.findIndex(t => t.id === task.id)
    const scored = ready.find(t => t.id === task.id)
    this.store.logEvent(eventSchema.parse({
      task_id: task.id,
      kind,
      urgency_at: scored?.urgency ?? null,
      urgency_rank_at: idx >= 0 ? idx + 1 : null,
      ready_count_at: ready.length,
    }))
  }
}
