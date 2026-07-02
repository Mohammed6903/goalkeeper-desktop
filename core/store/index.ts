import type { Goal, Project, Task, Event } from '../models'

/** Backend-agnostic persistence surface, ported from GoalKeeper's Python `Store` protocol.
 * The desktop app uses a single local SQLite implementation (see ./sqlite). */
export interface Store {
  // goals
  addGoal(g: Goal): Goal
  getGoal(id: string): Goal | null
  listGoals(): Goal[]
  updateGoal(g: Goal): void
  deleteGoal(id: string): void
  // projects
  addProject(p: Project): Project
  getProject(id: string): Project | null
  listProjects(goalId?: string | null): Project[]
  updateProject(p: Project): void
  deleteProject(id: string): void
  // tasks
  addTask(t: Task): Task
  getTask(idOrSeq: string | number): Task | null
  listTasks(projectId?: string | null, status?: string | null): Task[]
  updateTask(t: Task): void
  deleteTask(id: string): void
  nextSeq(): number
  // events
  logEvent(e: Event): void
  allEvents(): Event[]
  eventsFor(taskId: string): Event[]
}
