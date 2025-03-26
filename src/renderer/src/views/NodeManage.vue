<template>
    <div class="node-version">
        <div class="header">
            <div class="current-version">
                <template v-if="loading">
                    <el-skeleton :rows="1" style="width: 200px" />
                </template>
                <template v-else>
                    <div class="version-info">
                        <span class="version-label">当前 Node.js 版本:</span>
                        <el-tag type="success" class="version-tag">{{ currentNodeVersion || '未检测到' }}</el-tag>
                    </div>
                </template>
            </div>
            <div class="nvm-status">
                <div class="status-tag">
                    <template v-if="loading">
                        <el-skeleton :rows="1" style="width: 100px" />
                    </template>
                    <template v-else>
                        <div class="status-info">
                            <span class="status-label">nvm状态:</span>
                            <el-tag :type="isNvmInstalled ? 'success' : 'info'">
                                {{ isNvmInstalled ? '已安装' : '未安装' }}
                            </el-tag>
                        </div>
                    </template>
                </div>
                <div class="action-buttons">
                    <template v-if="loading">
                        <div class="skeleton-button"></div>
                    </template>
                    <template v-else>
                        <el-button v-if="!isNvmInstalled" @click="installNvm" :loading="installing" type="primary"
                            class="header-button">
                            {{ installing ? '安装中...' : '安装 nvm' }}
                        </el-button>
                        <el-button v-if="isNvmInstalled" @click="openInstallDialog" type="primary"
                            class="header-button">
                            添加 Node.js
                        </el-button>
                    </template>
                </div>
            </div>
        </div>

        <div class="node-list" v-if="isNvmInstalled">
            <h2>已安装的Node.js</h2>
            <el-skeleton :rows="3" animated v-if="loading" />
            <el-empty v-else-if="nodeList.length === 0" description="未找到已安装的 Node.js 版本" />
            <el-card v-else v-for="node in nodeList" :key="node.name" class="node-item">
                <div class="node-item-content">
                    <div class="node-info">
                        <div class="node-name">{{ node.name }}</div>
                        <div class="node-details">
                            <span>版本: {{ node.version }}</span>
                            <span v-if="node.path">路径: {{ node.path }}</span>
                            <span v-if="node.info">信息: {{ node.info }}</span>
                        </div>
                    </div>
                    <div class="node-actions">
                        <el-button @click="switchNode(node.name)" :loading="switching" type="primary"
                            size="default">
                            {{ switching ? '切换中...' : '切换' }}
                        </el-button>
                        <el-button @click="uninstallNode(node.name)" :loading="isNodeUninstalling(node.name)"
                            type="danger" size="default">
                            {{ isNodeUninstalling(node.name) ? '卸载中...' : '卸载' }}
                        </el-button>
                    </div>
                </div>
            </el-card>
        </div>

        <el-dialog v-model="showInstallDialog" title="安装 Node.js" width="60%" destroy-on-close
            class="node-install-dialog">
            <div class="dialog-content">
                <div v-if="loadingAvailableNodes" class="loading-container">
                    <el-skeleton :rows="5" animated />
                </div>
                <div v-else class="node-search-content">
                    <el-input v-model="searchQuery" placeholder="搜索 Node.js 版本" clearable class="search-input">
                        <template #prefix>
                            <el-icon>
                                <Search />
                            </el-icon>
                        </template>
                    </el-input>
                    <el-table :data="filteredNodes" style="width: 100%">
                        <el-table-column prop="name" label="Node.js 版本" />
                        <el-table-column prop="type" label="类型" width="150">
                            <template #default="scope">
                                <el-tag 
                                    :type="getTagType(scope.row.type)" 
                                    size="small">
                                    {{ getVersionTypeLabel(scope.row.type) }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column align="right" width="100">
                            <template #default="scope">
                                <el-button type="primary" size="small" @click="installNode(scope.row.name)"
                                    :loading="installingNode === scope.row.name">
                                    {{ installingNode === scope.row.name ? '安装中...' : '安装' }}
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

        <!-- 添加日志对话框 -->
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

        <!-- nvm 安装确认对话框 -->
        <el-dialog v-model="showNvmInstallDialog" title="安装 nvm" width="50%">
            <div class="nvm-install-info">
                <p>nvm 是一个 Node.js 版本管理工具，可以帮助您管理多个 Node.js 版本。</p>
                <p>
                    在安装前，您可以查看 nvm-windows 文档了解更多信息：
                </p>
                <el-input v-model="nvmDocsUrl" readonly class="docs-url-input">
                    <template #append>
                        <el-button @click="copyNvmUrl">复制链接</el-button>
                    </template>
                </el-input>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showNvmInstallDialog = false">取消</el-button>
                    <el-button type="primary" @click="confirmInstallNvm" :loading="installing">安装</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

// nvm相关命令统一管理
const nvmCommands = {
    version: 'nvm version',
    install: 'powershell -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/coreybutler/nvm-windows/master/nvm-setup.exe -OutFile $env:TEMP\\nvm-setup.exe; Start-Process -Wait $env:TEMP\\nvm-setup.exe"',
    list: 'nvm list',
    global: (nodeName) => `nvm use ${nodeName}`,
    uninstall: (nodeName) => `nvm uninstall ${nodeName}`,
    installNode: (nodeName) => `nvm install ${nodeName}`,
    nodeVersion: 'node --version',
    listAvailable: 'nvm list available'
}

const isNvmInstalled = ref(false)
const installing = ref(false)
const loading = ref(true)
const switching = ref(false)
const nodeList = ref([])
const currentNodeVersion = ref('')

// 日志相关的状态变量
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

// 安装 Node.js
async function installNode(nodeName) {
    installingNode.value = nodeName
    installInProgress.value = true
    installLog.value = `开始安装 Node.js ${nodeName}...\n`
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
        let installCommand = nvmCommands.installNode(nodeName)

        // 如果启用了代理，添加代理环境变量
        if (proxyString) {
            installLog.value += `使用代理: ${proxyString}\n`
            // 修改代理设置方式，使用引号包裹代理URL
            installCommand = `set "HTTP_PROXY=${proxyString}" && set "HTTPS_PROXY=${proxyString}" && ${installCommand}`
        }

        // 执行带实时输出的命令
        console.log('开始执行命令:', installCommand)
        const result = await window.electron.ipcRenderer.invoke('run-cmd-realtime', installCommand)
        console.log('命令执行结果:', result)

        // 移除事件监听器
        if (typeof removeListener === 'function') {
            removeListener()
            console.log('已移除事件监听器')
        }

        if (result.success) {
            await getNodeList()
            ElMessage.success('Node.js 安装成功')
            installLog.value += '✅ 安装完成！\n'
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        console.error('安装Node.js时发生错误:', error)
        installLog.value += `❌ 安装失败: ${error.message}\n`
        ElMessage.error('安装 Node.js 失败: ' + error.message)
    } finally {
        installingNode.value = ''
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

// 检查 nvm 安装状态
async function checkNvmInstallation() {
    const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.version, false)
    isNvmInstalled.value = result.success
}

// 获取已安装的 Node.js 列表
async function getNodeList() {
    loading.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.list)
        if (result.success) {
            nodeList.value = parseNodeList(result.data)
        }
    } catch (error) {
        console.error('获取 Node.js 列表失败:', error)
    } finally {
        loading.value = false
    }
}

// 切换 Node.js 版本
async function switchNode(nodeName) {
    switching.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.global(nodeName))
        if (!result.success) {
            throw new Error(result.error)
        }
        await getCurrentNodeVersion()
        await getNodeList() // 刷新 Node.js 列表
        ElMessage.success('Node.js 切换成功')
    } catch (error) {
        ElMessage.error('切换 Node.js 版本失败: ' + error.message)
    } finally {
        switching.value = false
    }
}

// 获取当前 Node.js 版本
async function getCurrentNodeVersion() {
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.nodeVersion, false)
        
        if (result.success) {
            const version = result.data.trim().replace('v', '')
            currentNodeVersion.value = version
        } else {
            currentNodeVersion.value = '未检测到'
        }
    } catch (error) {
        console.error('获取 Node.js 版本失败:', error)
        currentNodeVersion.value = '未检测到'
    }
}

// 解析 Node.js 列表输出
function parseNodeList(output) {
    const lines = output.split('\n')
    const nodeVersions = []
    
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        
        // 检查是否是当前使用的版本（通常会有 * 标记）
        const isCurrent = trimmed.includes('*')
        // 提取版本号，移除 * 和其他标记
        let version = trimmed.replace('*', '').trim()
        
        // 移除可能的 "(Currently using ...)" 部分
        if (version.includes('(')) {
            version = version.split('(')[0].trim()
        }
        
        if (version && !version.toLowerCase().includes('nvm')) {
            nodeVersions.push({
                name: version,
                version: version,
                path: '',
                info: isCurrent ? '当前使用版本' : ''
            })
        }
    }
    
    return nodeVersions
}

onMounted(async () => {
    await checkNvmInstallation()
    if (isNvmInstalled.value) {
        await Promise.all([
            getNodeList(),
            getCurrentNodeVersion()
        ])
    }
    loading.value = false // 所有数据加载完成后再设置为 false
})

// 安装对话框相关状态变量
const showInstallDialog = ref(false)
const loadingAvailableNodes = ref(false)
const availableNodes = ref([])
const installingNode = ref('')
const showNvmInstallDialog = ref(false)
const nvmDocsUrl = ref('https://github.com/coreybutler/nvm-windows#readme')
const uninstallingNodes = ref([])

// 打开安装弹窗
async function openInstallDialog() {
    showInstallDialog.value = true
    await loadAvailableNodes()
}

// 关闭安装弹窗
function closeInstallDialog() {
    showInstallDialog.value = false
    availableNodes.value = []
}

// 加载可用的 Node.js 版本
async function loadAvailableNodes() {
    loadingAvailableNodes.value = true
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.listAvailable)
        if (result.success) {
            availableNodes.value = parseAvailableNodes(result.data)
        }
    } catch (error) {
        console.error('加载可用 Node.js 版本失败:', error)
    } finally {
        loadingAvailableNodes.value = false
    }
}

// 解析可用的 Node.js 列表
function parseAvailableNodes(output) {
    console.log('原始输出:', output); // 添加日志以便调试
    
    const lines = output.split('\n');
    const nodeVersions = [];
    
    // 检查是否是表格格式
    const hasTable = output.includes('|') && 
                    (output.includes('CURRENT') || output.includes('LTS'));
    
    if (hasTable) {
        // 表格格式处理
        let headers = [];
        let isHeader = false;
        let isParsingSeparator = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 识别表头行
            if (trimmed.includes('|') && 
                (trimmed.includes('CURRENT') || trimmed.includes('LTS'))) {
                isHeader = true;
                headers = trimmed.split('|')
                    .map(h => h.trim())
                    .filter(h => h.length > 0);
                continue;
            }
            
            // 跳过分隔行
            if (isHeader && trimmed.includes('-') && trimmed.includes('|')) {
                isParsingSeparator = true;
                continue;
            }
            
            // 处理数据行
            if (isHeader && isParsingSeparator && trimmed.includes('|')) {
                const cells = trimmed.split('|')
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
                
                for (let i = 0; i < cells.length; i++) {
                    const version = cells[i];
                    if (version && /^\d+\.\d+\.\d+$/.test(version)) {
                        const headerType = i < headers.length ? headers[i] : 'Unknown';
                        const isLTS = headerType.includes('LTS');
                        
                        nodeVersions.push({
                            name: version,
                            version: version,
                            isLTS: isLTS,
                            type: headerType
                        });
                    }
                }
            }
        }
    } else {
        // 非表格格式处理
        let startParsing = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            if (trimmed.toLowerCase().includes('available versions:')) {
                startParsing = true;
                continue;
            }
            
            if (startParsing && !trimmed.startsWith('|') && !trimmed.includes('---')) {
                let version = trimmed;
                const isLTS = version.toLowerCase().includes('lts');
                
                if (isLTS) {
                    version = version.split('(')[0].trim();
                }
                
                nodeVersions.push({
                    name: version,
                    version: version,
                    isLTS: isLTS
                });
            }
        }
    }
    
    console.log('解析后的版本列表:', nodeVersions); // 添加日志以便调试
    return nodeVersions;
}

// 添加搜索相关的状态
const searchQuery = ref('')

// 添加筛选计算属性
const filteredNodes = computed(() => {
    if (!searchQuery.value) return availableNodes.value

    const query = searchQuery.value.toLowerCase()
    return availableNodes.value.filter(node =>
        node.name.toLowerCase().includes(query)
    )
})

// 检查Node.js是否正在卸载
function isNodeUninstalling(nodeName) {
    return uninstallingNodes.value.includes(nodeName)
}

// 卸载 Node.js
async function uninstallNode(nodeName) {
    uninstallingNodes.value.push(nodeName)
    try {
        const result = await window.electron.ipcRenderer.invoke('run-cmd', nvmCommands.uninstall(nodeName))
        if (result.success) {
            await getNodeList()
            ElMessage.success('Node.js 卸载成功')
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        ElMessage.error('卸载 Node.js 失败: ' + error.message)
    } finally {
        uninstallingNodes.value = uninstallingNodes.value.filter(name => name !== nodeName)
    }
}

// 复制 nvm 文档链接
function copyNvmUrl() {
    navigator.clipboard.writeText(nvmDocsUrl.value)
        .then(() => {
            ElMessage.success('链接已复制到剪贴板')
        })
        .catch(() => {
            ElMessage.error('复制失败，请手动复制')
        })
}

// 安装 nvm
function installNvm() {
    showNvmInstallDialog.value = true
}

// 确认安装 nvm
async function confirmInstallNvm() {
    installing.value = true
    installInProgress.value = true
    showNvmInstallDialog.value = false
    showLogDialog.value = true
    installLog.value = '开始安装 nvm...\n'
    
    try {
        // 设置事件监听器接收实时日志
        const handleOutput = (data) => {
            console.log('收到日志:', data)
            installLog.value += data + '\n'
        }
        
        // 添加事件监听器
        const removeListener = window.electron.ipcRenderer.on('cmd-output', handleOutput)
        
        // 获取代理设置
        const proxyString = getProxyString()
        let installCommand = nvmCommands.install
        
        // 如果启用了代理，添加代理环境变量
        if (proxyString) {
            installLog.value += `使用代理: ${proxyString}\n`
            // 修改代理设置方式，使用引号包裹代理URL
            installCommand = `set "HTTP_PROXY=${proxyString}" && set "HTTPS_PROXY=${proxyString}" && ${installCommand}`
        }
        
        // 执行安装命令
        const result = await window.electron.ipcRenderer.invoke('run-cmd-realtime', installCommand)
        
        // 移除事件监听器
        if (typeof removeListener === 'function') {
            removeListener()
        }
        
        if (result.success) {
            installLog.value += '✅ nvm 安装完成！请重启应用以使更改生效。\n'
            ElMessage.success('nvm 安装成功，请重启应用')
            await checkNvmInstallation()
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        console.error('安装 nvm 时发生错误:', error)
        installLog.value += `❌ 安装失败: ${error.message}\n`
        ElMessage.error('安装 nvm 失败: ' + error.message)
    } finally {
        installing.value = false
        installInProgress.value = false
    }
}
// 获取版本类型标签
function getVersionTypeLabel(type) {
    if (!type) return '标准版';
    
    if (type.includes('CURRENT')) return 'CURRENT（当前版本）';
    if (type.includes('LTS')) return 'LTS（长期支持版本）';
    if (type.includes('OLD STABLE')) return 'OLD STABLE（旧稳定版本）';
    if (type.includes('OLD UNSTABLE')) return 'OLD UNSTABLE（旧不稳定版本）';
    
    return type;
}

// 获取标签类型
function getTagType(type) {
    if (!type) return 'info';
    
    if (type.includes('CURRENT')) return 'success';
    if (type.includes('LTS')) return 'primary';
    if (type.includes('OLD STABLE')) return 'warning';
    if (type.includes('OLD UNSTABLE')) return 'danger';
    
    return 'info';
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

/* 日志内容样式 */
.log-content {
    color: #f0f0f0;
    font-family: 'Courier New', monospace;
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.5;
}

.node-actions {
    display: flex;
    gap: 5px;
    align-items: center;
}

.node-actions .el-button {
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
}

.current-version {
    font-size: 18px;
    font-weight: bold;
    min-width: 200px;
}

.nvm-status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 250px;
}

.status-tag {
    min-width: 120px;
}

.action-buttons {
    min-width: 100px;
}

/* 添加按钮占位样式 */
.skeleton-button {
    width: 100px;
    height: 32px;
    background-color: #f0f0f0;
    border-radius: 4px;
}

.node-list {
    margin-top: 20px;
}

.node-item {
    margin-bottom: 10px;
}

.node-item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.node-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.node-name {
    font-weight: bold;
    font-size: 16px;
}

.node-details {
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
:deep(.node-install-dialog .el-dialog__body) {
    padding: 0;
    height: calc(70vh - 120px);
}

.dialog-content {
    height: 100%;
    padding: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.node-search-content {
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
}

/* 修改弹窗底部样式 */
:deep(.node-install-dialog .el-dialog__footer) {
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
}

:deep(.el-table__body-wrapper) {
    overflow-y: auto;
    height: 100% !important;
}

/* nvm安装对话框样式 */
.nvm-install-info {
    padding: 10px;
    line-height: 1.6;
}

.docs-url-input {
    margin-top: 10px;
}

/* 添加固定宽度和溢出控制 */
.node-version {
    width: 100%;
    position: relative;
    overflow-x: hidden;
}
</style>