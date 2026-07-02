import { ipcMain, app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { SqliteStore } from '@core/store/sqlite'
import { Service } from '@core/service'
import { ConfigStore } from '@core/config'
import { setApiKey, hasApiKey } from './secret'

export { readApiKey } from './secret'

export function registerIpc(): void {
  const cfg = new ConfigStore(join(app.getPath('userData'), 'settings.json'))
  const store = new SqliteStore(join(app.getPath('userData'), 'goalkeeper.db'))
  let svc = new Service(store, cfg.get().urgency)
  const h = (ch: string, fn: (...a: any[]) => any) => ipcMain.handle(ch, (_e, ...a) => fn(...a))

  h('goals:list', () => svc.listGoals())
  h('goals:add', (title: string, o: any) => svc.addGoal(title, o))
  h('goals:complete', (id: string) => svc.completeGoal(id))
  h('goals:delete', (id: string) => svc.deleteGoal(id))
  h('projects:list', (goalId: string | null | undefined) => svc.listProjects(goalId))
  h('projects:add', (title: string, o: any) => svc.addProject(title, o))
  h('projects:complete', (id: string) => svc.completeProject(id))
  h('projects:delete', (id: string) => svc.deleteProject(id))
  h('tasks:list', (projectId: string | null | undefined, status: string | null | undefined) => svc.listTasks(projectId, status))
  h('tasks:score', () => svc.score())
  h('tasks:ready', () => svc.readyTasks())
  h('tasks:add', (title: string, o: any) => svc.addTask(title, o))
  h('tasks:start', (seq: string | number) => svc.startTask(seq))
  h('tasks:complete', (seq: string | number) => svc.completeTask(seq))
  h('tasks:modify', (task: any) => svc.modifyTask(task))
  h('tasks:delete', (id: string) => svc.deleteTask(id))
  h('config:get', () => cfg.get())
  h('config:save', (c: any) => { cfg.save(c); svc = new Service(store, c.urgency) })

  // Secret / API-key storage — uses safeStorage (OS keychain) via electron/secret.ts
  h('secret:setKey', (value: string) => setApiKey(value))
  h('secret:getKeyStatus', () => hasApiKey())

  // Window controls — need the event to resolve the sender's window
  ipcMain.handle('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
}
