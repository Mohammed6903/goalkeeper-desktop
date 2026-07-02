import type { Goal, Project, Task } from '@core/models'
import type { AppConfig } from '@core/config'

export interface GkApi {
  listGoals(): Promise<Goal[]>
  addGoal(title: string, o?: { description?: string; priority?: string; horizon?: string | null }): Promise<Goal>
  completeGoal(id: string): Promise<Goal | null>
  deleteGoal(id: string): Promise<void>
  listProjects(goalId?: string | null): Promise<Project[]>
  addProject(title: string, o?: { goalId?: string | null; description?: string }): Promise<Project>
  completeProject(id: string): Promise<Project | null>
  deleteProject(id: string): Promise<void>
  listTasks(projectId?: string | null, status?: string | null): Promise<Task[]>
  score(): Promise<Task[]>
  ready(): Promise<Task[]>
  addTask(title: string, o?: { projectId?: string | null; priority?: string; due?: string | null; estimateMinutes?: number | null; tags?: string[]; depends?: string[] }): Promise<Task>
  startTask(seq: string | number): Promise<Task | null>
  completeTask(seq: string | number): Promise<Task | null>
  modifyTask(task: Task): Promise<Task>
  deleteTask(id: string): Promise<void>
  getConfig(): Promise<AppConfig>
  saveConfig(c: AppConfig): Promise<void>
  minimizeWindow(): Promise<void>
  maximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
}

declare global {
  interface Window {
    gk: GkApi
  }
}
