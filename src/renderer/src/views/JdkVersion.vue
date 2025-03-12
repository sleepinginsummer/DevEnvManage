<template>
  <div class="jdk-version">
    <div class="header">
      <div class="current-version" v-if="currentJavaVersion">
        当前 JDK 版本: {{ currentJavaVersion }}
      </div>
      <div class="scoop-status">
        <el-tag :type="isScoopInstalled ? 'success' : 'info'">
          Scoop状态: {{ isScoopInstalled ? '已安装' : '未安装' }}
        </el-tag>
        <el-button 
          v-if="!isScoopInstalled" 
          @click="installScoop" 
          :loading="installing"
          type="primary"
        >
          {{ installing ? '安装中...' : '安装 Scoop' }}
        </el-button>
        <el-button 
          v-if="isScoopInstalled" 
          @click="openInstallDialog"
          type="primary"
        >
          添加 JDK
        </el-button>
      </div>
    </div>

    <div class="jdk-list" v-if="isScoopInstalled">
      <h2>已安装的 JDK 版本</h2>
      <el-skeleton :rows="3" animated v-if="loading" />
      <el-empty v-else-if="jdkList.length === 0" description="未找到已安装的 JDK 版本" />
      <el-card v-else v-for="jdk in jdkList" :key="jdk.name" class="jdk-item">
        <div class="jdk-item-content">
          <div class="jdk-info">
            <div class="jdk-name">{{ jdk.name }}</div>
            <div class="jdk-details">
              <span>版本: {{ jdk.version }}</span>
              <span>来源: {{ jdk.source }}</span>
              <span>更新时间: {{ jdk.updated }}</span>
              <span v-if="jdk.info">信息: {{ jdk.info }}</span>
            </div>
          </div>
          <div class="jdk-actions">
            <el-button 
              @click="switchJdk(jdk.name)" 
              :loading="switching"
              type="primary"
              size="small"
            >
              {{ switching ? '切换中...' : '切换' }}
            </el-button>
            <el-button 
              @click="uninstallJdk(jdk.name)"
              :loading="uninstallingJdk === jdk.name"
              type="danger"
              size="small"
            >
              {{ uninstallingJdk === jdk.name ? '卸载中...' : '卸载' }}
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="showInstallDialog"
      title="安装 JDK"
      width="60%"
      destroy-on-close
    >
      <el-alert
        v-if="checkingBucket || installingBucket"
        :title="checkingBucket ? '检查 Java bucket...' : '添加 Java bucket...'"
        type="info"
        :closable="false"
        show-icon
      />
      <div v-else-if="loadingAvailableJdks" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
      <div v-else>
        <!-- 添加搜索框 -->
        <el-input
          v-model="searchQuery"
          placeholder="搜索 JDK 名称或版本"
          prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-table :data="filteredJdks" style="width: 100%">
          <el-table-column prop="name" label="JDK 名称" />
          <el-table-column prop="version" label="版本" />
          <el-table-column align="right">
            <template #default="scope">
              <el-button
                type="primary"
                size="small"
                @click="installJdk(scope.row.name)"
                :loading="installingJdk === scope.row.name"
              >
                {{ installingJdk === scope.row.name ? '安装中...' : '安装' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeInstallDialog">关闭</el-button>
        </span>
      </template>
    </el-dialog>
     <!-- 添加新的日志对话框 -->
     <el-dialog
      v-model="showLogDialog"
      title="安装日志"
      width="70%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!installInProgress"
    >
      <div class="log-container">
        <pre class="log-content" ref="logContentRef">{{ installLog }}</pre>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeLogDialog" :disabled="installInProgress">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

const isScoopInstalled = ref(false)
const installing = ref(false)
const loading = ref(false)
const switching = ref(false)
const jdkList = ref([])
const currentJavaVersion = ref('')


// 添加日志相关的状态变量
const showLogDialog = ref(false)
const installLog = ref('')
const installInProgress = ref(false)
const logContentRef = ref(null)

// 关闭日志对话框
function closeLogDialog() {
  if (!installInProgress.value) {
    showLogDialog.value = false
    installLog.value = ''
  }
}

// 滚动日志到底部
watch(installLog, async () => {
  await nextTick()
  if (logContentRef.value) {
    logContentRef.value.scrollTop = logContentRef.value.scrollHeight
  }
})
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
    ElMessage.success('Scoop 安装成功')
  } catch (error) {
    ElMessage.error('安装 Scoop 失败: ' + error.message)
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
    ElMessage.success('JDK 切换成功')
  } catch (error) {
    ElMessage.error('切换 JDK 版本失败: ' + error.message)
  } finally {
    switching.value = false
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
// 修改 parseJdkList 函数
function parseJdkList(output) {
  const lines = output.split('\n')
  return lines
    .filter(line => line.includes('jdk') || line.includes('java'))
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        name: parts[0] || '未知',
        version: parts[1] || '未知',
        source: parts[2] || '未知',
        updated: parts[3]+" "+parts[4] || '未知',
        info: parts[5] || '' // 将剩余部分作为 info
      }
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

// 新增的状态变量
const showInstallDialog = ref(false)
const checkingBucket = ref(false)
const installingBucket = ref(false)
const loadingAvailableJdks = ref(false)
const availableJdks = ref([])
const installingJdk = ref('')

// 打开安装弹窗
async function openInstallDialog() {
  showInstallDialog.value = true
  await checkAndAddJavaBucket()
  await loadAvailableJdks()
}

// 关闭安装弹窗
function closeInstallDialog() {
  showInstallDialog.value = false
  availableJdks.value = []
}

// 检查并添加 Java bucket
async function checkAndAddJavaBucket() {
  checkingBucket.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', 'scoop bucket list')
    if (!result.data.toLowerCase().includes('java')) {
      installingBucket.value = true
      await window.electron.ipcRenderer.invoke('run-powershell', 'scoop bucket add java')
    }
  } catch (error) {
    console.error('检查或添加 Java bucket 失败:', error)
  } finally {
    checkingBucket.value = false
    installingBucket.value = false
  }
}

// 加载可用的 JDK 版本
async function loadAvailableJdks() {
  loadingAvailableJdks.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', 'scoop search jdk')
    if (result.success) {
      availableJdks.value = parseAvailableJdks(result.data)
    }
  } catch (error) {
    console.error('加载可用 JDK 版本失败:', error)
  } finally {
    loadingAvailableJdks.value = false
  }
}

// 解析可用的 JDK 列表
function parseAvailableJdks(output) {
  const lines = output.split('\n')
  return lines
    .filter(line => line.includes('jdk'))
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        name: parts[0],
        version: parts[1] || '未知版本'
      }
    })
}

// 安装 JDK
async function installJdk(jdkName) {
  installingJdk.value = jdkName
  installInProgress.value = true
  installLog.value = `开始安装 ${jdkName}...\n`
  showLogDialog.value = true
  
  try {
    // 设置事件监听器接收实时日志
    const handleOutput = (data) => {
      installLog.value += data + '\n'
    }
    
    // 添加事件监听器
    const removeListener = window.electron.ipcRenderer.on('powershell-output', handleOutput)
    
    // 使用新的方法执行带实时输出的命令
    const result = await window.electron.ipcRenderer.invoke('run-powershell-realtime', `scoop install ${jdkName}`)
    
    // 移除事件监听器 - 使用返回的函数而不是直接调用removeListener
    if (typeof removeListener === 'function') {
      removeListener()
    }
    
    if (result.success) {
      await getJdkList()
      ElMessage.success('JDK 安装成功')
      installLog.value += '✅ 安装完成！\n'
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.log(error)
    installLog.value += `❌ 安装失败: ${error.message}\n`
    ElMessage.error('安装 JDK 失败: ' + error.message)
  } finally {
    installingJdk.value = ''
    installInProgress.value = false
  }
}

// 添加搜索相关的状态
const searchQuery = ref('')

// 添加筛选计算属性
const filteredJdks = computed(() => {
  if (!searchQuery.value) return availableJdks.value
  
  const query = searchQuery.value.toLowerCase()
  return availableJdks.value.filter(jdk => 
    jdk.name.toLowerCase().includes(query) || 
    jdk.version.toLowerCase().includes(query)
  )
})

// 在 script setup 中添加新的状态变量和函数
const uninstallingJdk = ref('')

// 卸载 JDK
async function uninstallJdk(jdkName) {
  uninstallingJdk.value = jdkName
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', `scoop uninstall ${jdkName}`)
    if (result.success) {
      await getJdkList()
      ElMessage.success('JDK 卸载成功')
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    ElMessage.error('卸载 JDK 失败: ' + error.message)
  } finally {
    uninstallingJdk.value = ''
  }
}


</script>

<style scoped>
.log-container {
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 10px;
  height: 400px;
  overflow-y: auto;
}

.log-content {
  color: #f0f0f0;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  margin: 0;
  line-height: 1.5;
}
.jdk-actions {
  display: flex;
  gap: 10px;
  align-items: center;
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

.jdk-list {
  margin-top: 20px;
}

.jdk-item {
  margin-bottom: 10px;
}

.jdk-item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.jdk-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.jdk-name {
  font-weight: bold;
  font-size: 16px;
}

.jdk-details {
  display: flex;
  gap: 15px;
  color: #666;
  font-size: 14px;
}

.loading-container {
  padding: 20px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.search-input {
  margin-bottom: 20px;
  width: 100%;
}
</style>
