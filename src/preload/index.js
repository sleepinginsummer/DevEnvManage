import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 添加新的 IPC 方法
  runPowerShell: (command) => ipcRenderer.invoke('run-powershell', command)
}

if (process.contextIsolated) {
  try {
    // 在 contextBridge.exposeInMainWorld 中的 electron 对象中添加 terminate-process
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: {
        invoke: (channel, ...args) => {
          const validChannels = [
            'run-powershell',
            'run-powershell-window',
            'run-powershell-realtime',
            'run-cmd',
            'run-cmd-realtime'  // 添加新的通道
          ];
          if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
          }
          return Promise.reject(new Error(`未授权的 IPC 通道: ${channel}`));
        },
        on: (channel, func) => {
          const validChannels = ['powershell-output', 'cmd-output'];  // 添加新的输出通道
          if (validChannels.includes(channel)) {
            // 转换 IPC 事件为函数回调
            const subscription = (_event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
    
            // 返回一个清理函数，用于移除事件监听器
            return () => {
              ipcRenderer.removeListener(channel, subscription);
            };
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
