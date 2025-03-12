<template>
  <div class="jdk-version">
    <div class="header">
      <div class="current-version" v-if="currentJavaVersion">
        当前 JDK 版本: {{ currentJavaVersion }}
      </div>
      <div class="scoop-status">
        <span :class="{ 'status-text': true, 'installed': isScoopInstalled }">
          Scoop状态: {{ isScoopInstalled ? '已安装' : '未安装' }}
        </span>
        <button v-if="!isScoopInstalled" @click="installScoop" :disabled="installing">
          {{ installing ? '安装中...' : '安装 Scoop' }}
        </button>
      </div>
    </div>

    <div class="jdk-list" v-if="isScoopInstalled">
      <h2>已安装的 JDK 版本</h2>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="jdkList.length === 0" class="no-data">
        未找到已安装的 JDK 版本
      </div>
      <ul v-else>
        <li v-for="jdk in jdkList" :key="jdk.name" class="jdk-item">
          <span>{{ jdk.name }}</span>
          <button @click="switchJdk(jdk.name)" :disabled="switching">
            {{ switching ? '切换中...' : '切换' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isScoopInstalled = ref(false)
const installing = ref(false)
const loading = ref(false)
const switching = ref(false)
const jdkList = ref([])
const currentJavaVersion = ref('')

// 检查 Scoop 安装状态
async function checkScoopInstallation() {
  const result = await window.electron.ipcRenderer.invoke('run-powershell', 'scoop --version')
  isScoopInstalled.value = result.success
}

// 安装 Scoop
async function installScoop() {
  installing.value = true
  try {
    await window.electron.ipcRenderer.invoke('run-powershell', 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force')
    await window.electron.ipcRenderer.invoke('run-powershell', '& { iwr -useb get.scoop.sh | iex }')
    await checkScoopInstallation()
  } catch (error) {
    console.error('安装 Scoop 失败:', error)
  } finally {
    installing.value = false
  }
}

// 获取已安装的 JDK 列表
async function getJdkList() {
  loading.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', 'scoop list')
    if (result.success) {
      jdkList.value = parseJdkList(result.data)
    }
  } catch (error) {
    console.error('获取 JDK 列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 切换 JDK 版本
async function switchJdk(jdkName) {
  switching.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', `scoop reset ${jdkName}`)
    if (!result.success) {
      throw new Error(result.error)
    }
    await getCurrentJavaVersion()
    
    // // 成功切换后重启应用
    // await window.electron.ipcRenderer.invoke('restart-app')
  } catch (error) {
    console.error('切换 JDK 版本失败:', error)
  } finally {
    switching.value = 
false
  }
}

// 获取当前 Java 版本
async function getCurrentJavaVersion() {
  try {
    // 使用新的 PowerShell 会话获取 Java 版本
    const result = await window.electron.ipcRenderer.invoke('run-powershell-window', 'java -version')
    if (result.success) {
      currentJavaVersion.value = parseJavaVersion(result.data)
    }
  } catch (error) {
    console.error('获取 Java 版本失败:', error)
  }
}

// 解析 JDK 列表输出
function parseJdkList(output) {
  const lines = output.split('\n')
  return lines
    .filter(line => line.includes('jdk') || line.includes('java'))
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return { name: parts[0] }
    })
}

// 解析 Java 版本输出
function parseJavaVersion(output) {
  // 通常 java -version 输出的第一行包含版本信息
  const versionLine = output.split('\n')[0]
  const match = versionLine.match(/"(.+)"/)
  return match ? match[1] : '未知'
}

onMounted(async () => {
  await checkScoopInstallation()
  if (isScoopInstalled.value) {
    await Promise.all([
      getJdkList(),
      getCurrentJavaVersion()
    ])
  }
})
</script>

<style scoped>
.jdk-version {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.current-version {
  font-size: 18px;
  font-weight: bold;
}

.scoop-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-text {
  padding: 5px 10px;
  border-radius: 4px;
  background-color: var(--ev-c-gray-3);
}

.status-text.installed {
  background-color: #2f9e44;
}

button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  background-color: var(--ev-c-gray-2);
  color: var(--ev-c-text-1);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.jdk-list {
  margin-top: 20px;
}

.jdk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  background-color: var(--ev-c-gray-3);
  border-radius: 4px;
}

.loading, .no-data {
  text-align: center;
  padding: 20px;
  color: var(--ev-c-text-2);
}
</style>