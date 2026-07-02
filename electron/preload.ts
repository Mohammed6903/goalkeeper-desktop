import { contextBridge, ipcRenderer } from 'electron'
const inv = (ch: string) => (...a: any[]) => ipcRenderer.invoke(ch, ...a)
contextBridge.exposeInMainWorld('gk', {
  listGoals: inv('goals:list'),
  addGoal: inv('goals:add'),
  completeGoal: inv('goals:complete'),
  deleteGoal: inv('goals:delete'),
  listProjects: inv('projects:list'),
  addProject: inv('projects:add'),
  completeProject: inv('projects:complete'),
  deleteProject: inv('projects:delete'),
  listTasks: inv('tasks:list'),
  score: inv('tasks:score'),
  ready: inv('tasks:ready'),
  addTask: inv('tasks:add'),
  startTask: inv('tasks:start'),
  completeTask: inv('tasks:complete'),
  modifyTask: inv('tasks:modify'),
  deleteTask: inv('tasks:delete'),
  getConfig: inv('config:get'),
  saveConfig: inv('config:save'),
})
