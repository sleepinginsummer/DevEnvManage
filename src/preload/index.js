const { contextBridge, ipcRenderer } = require('electron')
const { electronAPI } = require('@electron-toolkit/preload')
// 引入 electron-log
const log = require('electron-log')

// 使用 contextBridge 将需要的 API 暴露给渲染进程
contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  runPowerShell: (command, showWindow = false) => ipcRenderer.invoke('run-powershell', command, showWindow),
  // ... 其他现有方法 ...
  
  // 添加日志相关的方法
  log: {
    info: (message) => log.info(message),
    warn: (message) => log.warn(message),
    error: (message) => log.error(message),
    debug: (message) => log.debug(message)
  }
})

// 暴露 ipcRenderer
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => {
    const validChannels = [
      'run-powershell',
      'run-powershell-realtime',
      'run-cmd',
      'run-cmd-realtime',
      'get-log-path',  // Make sure this is included
      'restart-app',
      'copy-to-clipboard',
      "run-powershell-admin"
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
})
