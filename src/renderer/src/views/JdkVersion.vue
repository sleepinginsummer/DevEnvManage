<template>
  <div class="jdk-version">
    <div class="header">
      <div class="current-version">
        <template v-if="loading">
          <el-skeleton :rows="1" style="width: 200px" />
        </template>
        <template v-else>
          <div class="version-info">
            <span class="version-label">当前 JDK 版本:</span>
            <el-tag type="success" class="version-tag">{{ currentJavaVersion || '未检测到' }}</el-tag>
          </div>
        </template>
      </div>
      <div class="scoop-status">
        <div class="status-tag">
          <template v-if="loading">
            <el-skeleton :rows="1" style="width: 100px" />
          </template>
          <template v-else>
            <div class="status-info">
              <span class="status-label">Scoop状态:</span>
              <el-tag :type="isScoopInstalled ? 'success' : 'info'">
                {{ isScoopInstalled ? '已安装' : '未安装' }}
              </el-tag>
            </div>
          </template>
        </div>
        <div class="action-buttons">
          <template v-if="loading">
            <div class="skeleton-button"></div>
          </template>
          <template v-else>
            <el-button 
              v-if="!isScoopInstalled" 
              @click="installScoop" 
              :loading="installing"
              type="primary"
              class="header-button"
            >
              {{ installing ? '安装中...' : '安装 Scoop' }}
            </el-button>
            <el-button 
              v-if="isScoopInstalled" 
              @click="openInstallDialog"
              type="primary"
              class="header-button"
            >
              添加 JDK
            </el-button>
          </template>
        </div>
      </div>
    </div>

    <div class="jdk-list" v-if="isScoopInstalled">
      <h2>已安装的JDK</h2>
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
              :loading="isJdkUninstalling(jdk.name)"
              type="danger"
              size="small"
            >
              {{ isJdkUninstalling(jdk.name) ? '卸载中...' : '卸载' }}
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
      class="jdk-install-dialog"
    >
      <div class="dialog-content">
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
        <div v-else class="jdk-search-content">
          <el-input
            v-model="searchQuery"
            placeholder="搜索 JDK 名称或版本"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
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
import { Search } from '@element-plus/icons-vue'
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

// Scoop相关命令统一管理
const scoopCommands = {
  version: 'scoop --version',
  installPolicy: 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force',
  install: '& { iwr -useb get.scoop.sh | iex }',
  list: 'scoop list',
  reset: (jdkName) => `scoop reset ${jdkName}`,
  uninstall: (jdkName) => `scoop uninstall ${jdkName}`,
  bucketList: 'scoop bucket list',
  bucketAdd: 'scoop bucket add java',
  search: 'scoop search jdk',
  installJdk: (jdkName) => `scoop install ${jdkName}`,
  javaVersion: 'java -version'
}

const isScoopInstalled = ref(false)
const installing = ref(false)
const loading = ref(true)
const switching = ref(false)
const jdkList = ref([])
const currentJavaVersion = ref('')


// 添加日志相关的状态变量
const showLogDialog = ref(false)
const installLog = ref('')
const installInProgress = ref(false)
const logContentRef = ref(null)
// 删除 currentInstallProcess 变量

// 关闭日志对话框
function closeLogDialog() {
  if (!installInProgress.value) {
    showLogDialog.value = false
    installLog.value = ''
  }
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
      console.log('收到日志:', data)
      installLog.value += data + '\n'
    }
    // 添加事件监听器
    const removeListener = window.electron.ipcRenderer.on('powershell-output', handleOutput)
    console.log('已添加事件监听器')
    // 使用新的方法执行带实时输出的命令
    console.log('开始执行命令:', scoopCommands.installJdk(jdkName))
    const result = await window.electron.ipcRenderer.invoke('run-powershell-realtime', scoopCommands.installJdk(jdkName))
    console.log('命令执行结果:', result)
    
    // 移除事件监听器 - 使用返回的函数而不是直接调用removeListener
    if (typeof removeListener === 'function') {
      removeListener()
      console.log('已移除事件监听器')
    }
    
    if (result.success) {
      await getJdkList()
      ElMessage.success('JDK 安装成功')
      installLog.value += '✅ 安装完成！\n'
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('安装JDK时发生错误:', error)
    installLog.value += `❌ 安装失败: ${error.message}\n`
    ElMessage.error('安装 JDK 失败: ' + error.message)
  } finally {
    installingJdk.value = ''
    installInProgress.value = false

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
  const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.version)
  isScoopInstalled.value = result.success
}

// 安装 Scoop
async function installScoop() {
  installing.value = true
  try {
    await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.installPolicy)
    await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.install)
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
    const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.list)
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
    const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.reset(jdkName))
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
    const result = await window.electron.ipcRenderer.invoke('run-powershell-window', scoopCommands.javaVersion)
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
  loading.value = false // 所有数据加载完成后再设置为 false
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
    const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.bucketList)
    if (!result.data.toLowerCase().includes('java')) {
      installingBucket.value = true
      await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.bucketAdd)
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
    const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.search)
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

// 在 script setup 中修改状态变量和函数
const uninstallingJdks = ref([])

// 检查JDK是否正在卸载
function isJdkUninstalling(jdkName) {
  return uninstallingJdks.value.includes(jdkName)
}

// 卸载 JDK
async function uninstallJdk(jdkName) {
  uninstallingJdks.value.push(jdkName)
  try {
    const result = await window.electron.ipcRenderer.invoke('run-powershell', scoopCommands.uninstall(jdkName))
    if (result.success) {
      await getJdkList()
      ElMessage.success('JDK 卸载成功')
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    ElMessage.error('卸载 JDK 失败: ' + error.message)
  } finally {
    uninstallingJdks.value = uninstallingJdks.value.filter(name => name !== jdkName)
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

/* 添加新的样式 */
.version-info, .status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-label, .status-label {
  white-space: nowrap;
}

/* 添加版本标签样式 */
.version-tag {
  font-size: 16px;
  font-weight: bold;
  padding: 4px 10px;
}

/* 其余样式保持不变 */
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
  min-height: 40px; /* 添加最小高度 */
}

.current-version {
  font-size: 18px;
  font-weight: bold;
  min-width: 200px; /* 添加最小宽度 */
}

.scoop-status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 250px; /* 添加最小宽度 */
}

.status-tag {
  min-width: 120px; /* 添加最小宽度 */
}

.action-buttons {
  min-width: 100px; /* 添加最小宽度 */
}

/* 添加按钮占位样式 */
.skeleton-button {
  width: 100px;
  height: 32px;
  background-color: #f0f0f0;
  border-radius: 4px;
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
/* 修改弹窗内容的样式 */
:deep(.jdk-install-dialog .el-dialog__body) {
  padding: 0;
  height: calc(70vh - 120px); /* 减去头部和底部的高度 */
}

.dialog-content {
  height: 100%;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.jdk-search-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 修改表格容器样式 */
.el-table {
  flex: 1;
  overflow: hidden;
}

:deep(.el-table__body-wrapper) {
  overflow-y: auto;
  max-height: calc(100% - 40px); /* 减去表头高度 */
}

/* 修改弹窗底部样式 */
:deep(.jdk-install-dialog .el-dialog__footer) {
  padding: 20px;
  border-top: 1px solid #dcdfe6;
  background: white;
}

/* 修改搜索框样式 */
.search-input {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  padding: 10px 0;
  margin: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.search-input .el-input__wrapper) {
  padding-left: 8px;
}

:deep(.search-input .el-input__prefix) {
  margin-right: 4px;
}

/* 修改表格容器样式 */
.el-table {
  flex: 1;
  height: 0;  /* 关键修改：让表格自适应剩余空间 */
}

:deep(.el-table__body-wrapper) {
  overflow-y: auto;
  height: 100% !important;
}

/* 添加固定宽度和溢出控制 */
.jdk-version {
  width: 100%;
  position: relative;
  overflow-x: hidden;
}
</style>

<style>
/* 更全面的解决方案 - 修改滚动条显示 */
html, body {
  overflow-x: hidden !important;
  margin-right: 0 !important;
  width: 100% !important;
  overflow-y: hidden !important; /* 完全隐藏垂直滚动条 */
}

/* 防止弹窗影响布局 */
.el-popup-parent--hidden {
  overflow-y: inherit !important;
  padding-right: 0 !important;
}

/* 修改弹窗样式 */
.el-dialog {
  margin: 0 auto !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
}

/* 确保遮罩层不影响布局 */
.el-overlay {
  position: fixed !important;
}

/* 为应用内容区域添加滚动，而不是整个页面 */
#app {
  height: 100vh;
  overflow-y: auto;
}

/* 确保弹窗打开时不会影响布局 */
.el-popup-parent--hidden #app {
  padding-right: 0 !important;
}
</style>
