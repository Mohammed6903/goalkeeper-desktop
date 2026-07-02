import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpc } from './ipc'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    frame: false,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
