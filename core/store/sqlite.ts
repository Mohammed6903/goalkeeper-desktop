import Database from 'better-sqlite3'
import type { Store } from './index'
import {
  goalSchema, projectSchema, taskSchema, eventSchema,
  type Goal, type Project, type Task, type Event,
} from '../models'

const J = JSON.stringify

export class SqliteStore implements Store {
  private db: Database.Database

  constructor(path: string) {
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS goals(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, goal_id TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, seq INTEGER, project_id TEXT, status TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, task_id TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v INTEGER);
      INSERT OR IGNORE INTO meta(k, v) VALUES('seq', 0);
    `)
  }

  // ── Goals ────────────────────────────────────────────────────────────────

  addGoal(g: Goal): Goal {
    this.db.prepare('INSERT INTO goals(id,data) VALUES(?,?)').run(g.id, J(g))
    return g
  }

  getGoal(id: string): Goal | null {
    const r = this.db.prepare('SELECT data FROM goals WHERE id=?').get(id) as any
    return r ? goalSchema.parse(JSON.parse(r.data)) : null
  }

  listGoals(): Goal[] {
    return (this.db.prepare('SELECT data FROM goals').all() as any[])
      .map(r => goalSchema.parse(JSON.parse(r.data)))
  }

  updateGoal(g: Goal): void {
    this.db.prepare('UPDATE goals SET data=? WHERE id=?').run(J(g), g.id)
  }

  deleteGoal(id: string): void {
    this.db.prepare('DELETE FROM goals WHERE id=?').run(id)
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  addProject(p: Project): Project {
    this.db.prepare('INSERT INTO projects(id,goal_id,data) VALUES(?,?,?)').run(p.id, p.goal_id, J(p))
    return p
  }

  getProject(id: string): Project | null {
    const r = this.db.prepare('SELECT data FROM projects WHERE id=?').get(id) as any
    return r ? projectSchema.parse(JSON.parse(r.data)) : null
  }

  listProjects(goalId?: string | null): Project[] {
    const rows = goalId
      ? this.db.prepare('SELECT data FROM projects WHERE goal_id=?').all(goalId)
      : this.db.prepare('SELECT data FROM projects').all()
    return (rows as any[]).map(r => projectSchema.parse(JSON.parse(r.data)))
  }

  updateProject(p: Project): void {
    this.db.prepare('UPDATE projects SET goal_id=?,data=? WHERE id=?').run(p.goal_id, J(p), p.id)
  }

  deleteProject(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id=?').run(id)
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  addTask(t: Task): Task {
    this.db.prepare('INSERT INTO tasks(id,seq,project_id,status,data) VALUES(?,?,?,?,?)')
      .run(t.id, t.seq, t.project_id, t.status, J(t))
    return t
  }

  getTask(idOrSeq: string | number): Task | null {
    const r = (typeof idOrSeq === 'number' || /^\d+$/.test(String(idOrSeq)))
      ? this.db.prepare('SELECT data FROM tasks WHERE seq=?').get(Number(idOrSeq))
      : this.db.prepare('SELECT data FROM tasks WHERE id=?').get(idOrSeq)
    return r ? taskSchema.parse(JSON.parse((r as any).data)) : null
  }

  listTasks(projectId?: string | null, status?: string | null): Task[] {
    const where: string[] = []
    const args: any[] = []
    if (projectId) { where.push('project_id=?'); args.push(projectId) }
    if (status)    { where.push('status=?');     args.push(status) }
    const sql = 'SELECT data FROM tasks'
      + (where.length ? ' WHERE ' + where.join(' AND ') : '')
      + ' ORDER BY seq'
    return (this.db.prepare(sql).all(...args) as any[])
      .map(r => taskSchema.parse(JSON.parse(r.data)))
  }

  updateTask(t: Task): void {
    this.db.prepare('UPDATE tasks SET seq=?,project_id=?,status=?,data=? WHERE id=?')
      .run(t.seq, t.project_id, t.status, J(t), t.id)
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id=?').run(id)
  }

  nextSeq(): number {
    this.db.prepare("UPDATE meta SET v=v+1 WHERE k='seq'").run()
    return (this.db.prepare("SELECT v FROM meta WHERE k='seq'").get() as any).v
  }

  // ── Events ────────────────────────────────────────────────────────────────

  logEvent(e: Event): void {
    this.db.prepare('INSERT INTO events(id,task_id,data) VALUES(?,?,?)').run(e.id, e.task_id, J(e))
  }

  allEvents(): Event[] {
    return (this.db.prepare('SELECT data FROM events').all() as any[])
      .map(r => eventSchema.parse(JSON.parse(r.data)))
  }

  eventsFor(taskId: string): Event[] {
    return (this.db.prepare('SELECT data FROM events WHERE task_id=?').all(taskId) as any[])
      .map(r => eventSchema.parse(JSON.parse(r.data)))
  }
}
