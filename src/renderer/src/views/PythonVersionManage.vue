<template>
    <div class="python-version">
        <div class="header">
            <div class="current-version">
                <template v-if="loading">
                    <el-skeleton :rows="1" style="width: 200px" />
                </template>
                <template v-else>
                    <div class="version-info">
                        <span class="version-label">当前 Python 版本:</span>
                        <el-tag type="success" class="version-tag">{{ currentPythonVersion || '未检测到' }}</el-tag>
                    </div>
                </template>
            </div>
            <div class="pyenv-status">
                <div class="status-tag">
                    <template v-if="loading">
                        <el-skeleton :rows="1" style="width: 100px" />
                    </template>
                    <template v-else>
                        <div class="status-info">
                            <span class="status-label">pyenv状态:</span>
                            <el-tag :type="isPyenvInstalled ? 'success' : 'info'">
                                {{ isPyenvInstalled ? '已安装' : '未安装' }}
                            </el-tag>
                        </div>
                    </template>
                </div>
                <div class="action-buttons">
                    <template v-if="loading">
                        <div class="skeleton-button"></div>
                    </template>
                    <template v-else>
                        <el-button v-if="!isPyenvInstalled" @click="installPyenv" :loading="installing" type="primary"
                            class="header-button">
                            {{ installing ? '安装中...' : '安装 pyenv' }}
                        </el-button>
                        <el-button v-if="isPyenvInstalled" @click="openInstallDialog" type="primary"
                            class="header-button">
                            添加 Python
                        </el-button>
                   
                    </template>
                </div>
            </div>
        </div>

        <div class="python-list" v-if="isPyenvInstalled">
            <h2>已安装的Python</h2>
            <el-skeleton :rows="3" animated v-if="loading" />
            <el-empty v-else-if="pythonList.length === 0" description="未找到已安装的 Python 版本" />
            <el-card v-else v-for="python in pythonList" :key="python.name" class="python-item">
                <div class="python-item-content">
                    <div class="python-info">
                        <div class="python-name">{{ python.name }}</div>
                        <div class="python-details">
                            <span>版本: {{ python.version }}</span>
                            <span v-if="python.path">路径: {{ python.path }}</span>
                            <span v-if="python.info">信息: {{ python.info }}</span>
                        </div>
                    </div>
                    <div class="python-actions">
                        <el-button @click="switchPython(python.name)" :loading="switching" type="primary"
                            size="default">
                            {{ switching ? '切换中...' : '切换' }}
                        </el-button>
                        <el-button @click="uninstallPython(python.name)" :loading="isPythonUninstalling(python.name)"
                            type="danger" size="default">
                            {{ isPythonUninstalling(python.name) ? '卸载中...' : '卸载' }}
                        </el-button>
                    </div>
                </div>
            </el-card>
        </div>

        <el-dialog v-model="showInstallDialog" title="安装 Python" width="60%" destroy-on-close
            class="python-install-dialog">
            <div class="dialog-content">
                <div v-if="loadingAvailablePythons" class="loading-container">
                    <el-skeleton :rows="5" animated />
                </div>
                <div v-else class="python-search-content">
                    <el-input v-model="searchQuery" placeholder="搜索 Python 版本" clearable class="search-input">
                        <template #prefix>
                            <el-icon>
                                <Search />
                            </el-icon>
                        </template>
                    </el-input>
                    <el-table :data="filteredPythons" style="width: 100%">
                        <el-table-column prop="name" label="Python 版本" />
                        <el-table-column align="right">
                            <template #default="scope">
                                <el-button type="primary" size="small" @click="installPython(scope.row.name)"
                                    :loading="installingPython === scope.row.name">
                                    {{ installingPython === scope.row.name ? '安装中...' : '安装' }}
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
        <el-dialog v-model="showLogDialog" title="安装日志" width="70%" :close-on-click-modal="false"
            :close-on-press-escape="false" :show-close="!installInProgress">
            <div class="log-container">
                <pre class="log-content" ref="logContentRef">{{ installLog }}</pre>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="closeLogDialog" :disabled="installInProgress">关闭</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 在其他对话框后添加 pyenv 安装确认对话框 -->
        <el-dialog v-model="showPyenvInstallDialog" title="安装 pyenv" width="50%">
            <div class="pyenv-install-info">
                <p>pyenv 是一个 Python 版本管理工具，可以帮助您管理多个 Python 版本。</p>
                <p>
                    在安装前，您可以查看 pyenv-win 文档了解更多信息：
                </p>
                <el-input v-model="pyenvDocsUrl" readonly class="docs-url-input">
                    <template #append>
                        <el-button @click="copyPyenvUrl">复制链接</el-button>
                    </template>
                </el-input>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showPyenvInstallDialog = false">取消</el-button>
                </span>
            </template>
        </el-dialog>
    </div>


</template>

<script setup>
import { Search } from '@element-plus/icons-vue'
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

// pyenv相关命令统一管理
const pyenvCommands = {
    version: 'pyenv',
    installPolicy: 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force',
    install: '& { iwr -useb https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1 | iex }',
    list: 'pyenv versions',
    global: (pythonName) => `pyenv global ${pythonName}`,
    uninstall: (pythonName) => `pyenv uninstall ${pythonName}`,
    installPython: (pythonName) => `pyenv install ${pythonName}`,
    pythonVersion: 'python --version',
    listAvailable: 'pyenv install --list'
}

const isPyenvInstalled = ref(false)
const installing = ref(false)
const loading = ref(true)
const switching = ref(false)
const pythonList = ref([])
const currentPythonVersion = ref('')

// 添加日志相关的状态变量
const showLogDialog = ref(false)
const installLog = ref('')
const installInProgress = ref(false)
const logContentRef = ref(null)







// 获取代理字符串
function getProxyString() {
    const host = localStorage.getItem('cmdProxyHost') || ''
    const port = localStorage.getItem('cmdProxyPort') || ''
    const enabled = localStorage.getItem('cmdProxyEnabled') === 'true'
    
    if (enabled && host && port) {
        return `http://${host}:${port}`
    }
    return ''
}

// 关闭日志对话框
function closeLogDialog() {
    if (!installInProgress.value) {
        showLogDialog.value = false
        installLog.value = ''
    }
}

// 安装 Python
async function installPython(pythonName) {
    installingPython.value = pythonName
    installInProgress.value = true
    installLog.value = `开始安装 Python ${pythonName}...\n`
    showLogDialog.value = true

    try {
        // 设置事件监听器接收实时日志
        const handleOutput = (data) => {
            console.log('收到日志:', data)
            installLog.value += data + '\n'
        }
        // 添加事件监听器
        const removeListener = window.electron.ipcRenderer.on('cmd-output', handleOutput)
        console.log('已添加事件监听器')

        // 获取代理设置
        const proxyString = getProxyString()
        let installCommand = pyenvCommands.installPython(pythonName)

        // 如果启用了代理，添加代理环境变量
        if (proxyString) {
            installLog.value += `使用代理: ${proxyString}\n`
            installCommand = `set HTTP_PROXY=${proxyString} && set HTTPS_PROXY=${proxyString} && ${installCommand}`
        }

        // 使用新的方法执行带实时输出的命令
        console.log('开始执行命令:', installCommand)
        const result = await window.electron.ipcRenderer.invoke('run-cmd-realtime', installCommand)
        console.log('命令执行结果:', result)

        // 移除事件监听器
        if (typeof removeListener === 'function') {
            removeListener()
            console.log('已移除事件监听器')
        }

        if (result.success) {
            await getPythonList()
            ElMessage.success('Python 安装成功')
            installLog.value += '✅ 安装完成！\n'
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        console.error('安装Python时发生错误:', error)
        installLog.value += `❌ 安装失败: ${error.message}\n`
        ElMessage.error('安装 Python 失败: ' + error.message)
    } finally {
        installingPython.value = ''
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

// 检查 pyenv 安装状态
async function checkPyenvInstallation() {
    const result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.version)
    isPyenvInstalled.value = result.success
}

// 获取已安装的 Python 列表
async function getPythonList() {
    loading.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.list)
        if (result.success) {
            pythonList.value = parsePythonList(result.data)
        }
    } catch (error) {
        console.error('获取 Python 列表失败:', error)
    } finally {
        loading.value = false
    }
}

// 切换 Python 版本
async function switchPython(pythonName) {
    switching.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.global(pythonName))
        if (!result.success) {
            throw new Error(result.error)
        }
        await getCurrentPythonVersion()
        await getPythonList() // 添加这一行来刷新 Python 列表
        ElMessage.success('Python 切换成功')
    } catch (error) {
        ElMessage.error('切换 Python 版本失败: ' + error.message)
    } finally {
        switching.value = false
    }
}

// 获取当前 Python 版本
async function getCurrentPythonVersion() {
    try {
        // 首先尝试使用 python --version
        let result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.pythonVersion,false)
        
        if (result.success) {
            const version = parsePythonVersion(result.data)
            if (version !== '未检测到') {
                currentPythonVersion.value = version
                return
            }
        }
        
        // 如果上面的方法失败，尝试使用python -c打印版本
        result = await window.electron.ipcRenderer.invoke('run-cmd', 'python -c "import sys; print(sys.version.split()[0])" 2>&1',false)
        
        if (result.success && result.data.trim() && !result.data.includes('不是内部或外部命令')) {
            currentPythonVersion.value = result.data.trim()
            return
        }
        
        // 如果还是失败，尝试使用py命令(Windows Python Launcher)
        result = await window.electron.ipcRenderer.invoke('run-cmd', 'py --version 2>&1',false)
        
        if (result.success) {
            const version = parsePythonVersion(result.data)
            if (version !== '未检测到') {
                currentPythonVersion.value = version
                return
            }
        }
        
        // 所有方法都失败
        currentPythonVersion.value = '未检测到'
        console.log('无法检测到Python版本')
    } catch (error) {
        console.error('获取 Python 版本失败:', error)
        currentPythonVersion.value = '未检测到'
    }
}

// 解析 Python 列表输出
function parsePythonList(output) {
    const lines = output.split('\n')
    return lines
        .filter(line => line.trim() && !line.includes('system'))
        .map(line => {
            // 处理可能的当前版本标记 (*)
            const isCurrent = line.includes('*')
            const cleanLine = line.replace('*', '').trim()

            return {
                name: cleanLine,
                version: cleanLine, // 在pyenv中，名称通常就是版本号
                path: '',
                info: isCurrent ? '当前使用版本' : ''
            }
        })
}

// 解析 Python 版本输出
function parsePythonVersion(output) {
    console.log('Python版本输出:', output) // 添加日志以便调试
    
    // 尝试多种可能的格式匹配
    // 1. 标准格式: "Python 3.9.7"
    let match = output.match(/Python\s+([\d\.]+)/i)
    if (match) return match[1]
    
    // 2. 可能包含额外信息: "Python 3.9.7 (tags/v3.9.7:1016ef3, Aug 30 2021, 20:19:38)"
    match = output.match(/Python\s+([\d\.]+)[\s\(]/i)
    if (match) return match[1]
    
    // 3. 可能是多行输出，尝试在每行中查找
    const lines = output.split('\n')
    for (const line of lines) {
        match = line.match(/Python\s+([\d\.]+)/i)
        if (match) return match[1]
    }
    
    // 4. 尝试使用更宽松的正则表达式匹配任何形式的版本号
    match = output.match(/(\d+\.\d+(\.\d+)?)/i)
    if (match) return match[1]
    
    // 5. 如果上述都失败，尝试直接运行python -c命令获取版本
    return '未检测到'
}

onMounted(async () => {
    await checkPyenvInstallation()
    if (isPyenvInstalled.value) {
        await Promise.all([
            getPythonList(),
            getCurrentPythonVersion()
        ])
    }
    loading.value = false // 所有数据加载完成后再设置为 false
})

// 新增的状态变量
const showInstallDialog = ref(false)
const loadingAvailablePythons = ref(false)
const availablePythons = ref([])
const installingPython = ref('')

// 打开安装弹窗
async function openInstallDialog() {
    showInstallDialog.value = true
    await loadAvailablePythons()
}

// 关闭安装弹窗
function closeInstallDialog() {
    showInstallDialog.value = false
    availablePythons.value = []
}

// 加载可用的 Python 版本
async function loadAvailablePythons() {
    loadingAvailablePythons.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.listAvailable)
        if (result.success) {
            availablePythons.value = parseAvailablePythons(result.data)
        }
    } catch (error) {
        console.error('加载可用 Python 版本失败:', error)
    } finally {
        loadingAvailablePythons.value = false
    }
}

// 解析可用的 Python 列表
function parseAvailablePythons(output) {
    const lines = output.split('\n')
    return lines
        .filter(line => {
            const trimmed = line.trim()
            return trimmed &&
                !trimmed.includes('Available versions:') &&
                !trimmed.includes('--') &&
                !trimmed.includes('Mirror: https://www.python.org/ftp/python')
        })
        .map(line => {
            return {
                name: line.trim(),
                version: line.trim() // 在pyenv中，名称通常就是版本号
            }
        })
}

// 添加搜索相关的状态
const searchQuery = ref('')

// 添加筛选计算属性
const filteredPythons = computed(() => {
    if (!searchQuery.value) return availablePythons.value

    const query = searchQuery.value.toLowerCase()
    return availablePythons.value.filter(python =>
        python.name.toLowerCase().includes(query)
    )
})

// 添加卸载相关的状态变量和函数
const uninstallingPythons = ref([])

// 检查Python是否正在卸载
function isPythonUninstalling(pythonName) {
    return uninstallingPythons.value.includes(pythonName)
}

// 卸载 Python
async function uninstallPython(pythonName) {
    uninstallingPythons.value.push(pythonName)
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', pyenvCommands.uninstall(pythonName))
        if (result.success) {
            await getPythonList()
            ElMessage.success('Python 卸载成功')
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        ElMessage.error('卸载 Python 失败: ' + error.message)
    } finally {
        uninstallingPythons.value = uninstallingPythons.value.filter(name => name !== pythonName)
    }
}

// 添加新的状态变量
const showPyenvInstallDialog = ref(false)
const pyenvDocsUrl = ref('https://github.com/pyenv-win/pyenv-win#readme')

// 复制 pyenv 文档链接
function copyPyenvUrl() {
    navigator.clipboard.writeText(pyenvDocsUrl.value)
        .then(() => {
            ElMessage.success('链接已复制到剪贴板')
        })
        .catch(() => {
            ElMessage.error('复制失败，请手动复制')
        })
}

// 修改安装 pyenv 的函数
function installPyenv() {
    showPyenvInstallDialog.value = true
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
.version-info,
.status-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.version-label,
.status-label {
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

.python-actions {
    display: flex;
    gap: -3px;
    /* 从10px减小到5px */
    align-items: center;
}

.python-actions .el-button {
    min-width: 80px;
    padding: 8px 16px;
    font-size: 14px;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    min-height: 40px;
    /* 添加最小高度 */
}

.current-version {
    font-size: 18px;
    font-weight: bold;
    min-width: 200px;
    /* 添加最小宽度 */
}

.pyenv-status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 250px;
    /* 添加最小宽度 */
}

.status-tag {
    min-width: 120px;
    /* 添加最小宽度 */
}

.action-buttons {
    min-width: 100px;
    /* 添加最小宽度 */
}

/* 添加按钮占位样式 */
.skeleton-button {
    width: 100px;
    height: 32px;
    background-color: #f0f0f0;
    border-radius: 4px;
}

.python-list {
    margin-top: 20px;
}

.python-item {
    margin-bottom: 10px;
}

.python-item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.python-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.python-name {
    font-weight: bold;
    font-size: 16px;
}

.python-details {
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
:deep(.python-install-dialog .el-dialog__body) {
    padding: 0;
    height: calc(70vh - 120px);
    /* 减去头部和底部的高度 */
}

.dialog-content {
    height: 100%;
    padding: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.python-search-content {
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
    max-height: calc(100% - 40px);
    /* 减去表头高度 */
}

/* 修改弹窗底部样式 */
:deep(.python-install-dialog .el-dialog__footer) {
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
    height: 0;
    /* 关键修改：让表格自适应剩余空间 */
}

:deep(.el-table__body-wrapper) {
    overflow-y: auto;
    height: 100% !important;
}

/* 添加固定宽度和溢出控制 */
.python-version {
    width: 100%;
    position: relative;
    overflow-x: hidden;
}
</style>

<style>
/* 更全面的解决方案 - 修改滚动条显示 */
html,
body {
    overflow-x: hidden !important;
    margin-right: 0 !important;
    width: 100% !important;
    overflow-y: hidden !important;
    /* 完全隐藏垂直滚动条 */
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
