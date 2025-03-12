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
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on(channel, callback) {
          const subscription = (_event, ...args) => callback(...args)
          // 这里错误地使用了 electron.ipcRenderer，应该使用导入的 ipcRenderer
          ipcRenderer.on(channel, subscription)
          
          return () => {
            // 这里也错误地使用了 electron.ipcRenderer
            ipcRenderer.removeListener(channel, subscription)
          }
        }
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
