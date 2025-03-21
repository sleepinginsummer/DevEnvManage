import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')


// 异步初始化日志
async function initLog() {
  try {
    // 使用暴露的 API 而不是直接 require
    // 通过 IPC 获取日志路径
    const logPath = await window.ipcRenderer.invoke('get-log-path')
    
    // 使用暴露的日志 API
    window.api.log.info('渲染进程初始化')
    window.api.log.info(`使用日志路径: ${logPath}`)
  } catch (error) {
    console.error('初始化日志失败:', error)
  }
}

initLog()
