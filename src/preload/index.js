import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 添加新的 IPC 方法
  runPowerShell: (command) => ipcRenderer.invoke('run-powershell', command)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
