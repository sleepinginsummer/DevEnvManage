<template>
    <div class="package-manage-container">
        <div class="header-actions">
            <!-- 添加版本显示 -->
            <div class="version-info">
                <template v-if="loading">
                    <el-skeleton :rows="1" style="width: 200px" />
                </template>
                <template v-else>
                    <span class="version-label">当前 Python 版本:</span>
                    <el-tag type="success" class="version-tag">{{ currentPythonVersion || '未检测到' }}</el-tag>
                </template>
            </div>
            <el-button type="primary" @click="refreshPackages">刷新列表</el-button>
        </div>

        <el-table v-loading="loading" :data="packages" style="width: 100%" height="calc(100% - 60px)">
            <el-table-column prop="name" label="包名" width="200">
                <template #default="{ row }">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        {{ row.name }}
                        <el-tag v-if="row.isBuiltin" size="small" type="info">内置</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="version" label="版本" width="150" />
            <!-- <el-table-column prop="location" label="安装位置" width="300" /> -->
            <!-- <el-table-column prop="summary" label="描述" /> -->
            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                    <el-button 
                        type="danger" 
                        size="small" 
                        :loading="row.uninstalling" 
                        :disabled="row.isBuiltin"
                        @click="uninstallPackage(row)"
                    >
                        卸载
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const packages = ref([])

// 在 script setup 部分添加内置包列表
const builtinPackages = new Set([
    'pip', 'setuptools', 'wheel',  // 包管理相关
    'distutils', 'ensurepip', 'venv',
    
    // 标准库核心模块
    'abc', 'argparse', 'array', 'ast',
    'asyncio', 'base64', 'collections',
    'concurrent', 'contextlib', 'copy',
    'datetime', 'decimal', 'email',
    'enum', 'functools', 'glob',
    'hashlib', 'http', 'importlib',
    'inspect', 'io', 'itertools',
    'json', 'logging', 'math',
    'multiprocessing', 'operator', 'os',
    'pathlib', 'pickle', 'platform',
    'queue', 're', 'random',
    'shutil', 'signal', 'socket',
    'sqlite3', 'ssl', 'string',
    'subprocess', 'sys', 'tempfile',
    'threading', 'time', 'typing',
    'unittest', 'urllib', 'uuid',
    'warnings', 'weakref', 'xml',
    'zipfile', 'zlib'
])

// 修改 loadPackages 方法
const loadPackages = async () => {
    loading.value = true
    try {
        // 获取标准库列表
        const stdlibResult = await window.electron.ipcRenderer.invoke('run-cmd', 
            'python -c "import sys; print(\',\'.join(sys.stdlib_module_names))" 2>&1', 
            false
        )
        
        let stdLibModules = new Set(['pip', 'setuptools', 'wheel'])
        if (stdlibResult.success) {
            const modules = stdlibResult.data.split(',')
            modules.forEach(module => stdLibModules.add(module))
        }

        // 获取基本包列表
        const result = await window.electron.ipcRenderer.invoke('run-cmd', 'pip list --format=json')
        if (result.success) {
            const packagesData = JSON.parse(result.data)
            packages.value = packagesData.map(pkg => ({
                name: pkg.name,
                version: pkg.version,
                summary: '加载中...',
                uninstalling: false,
                isBuiltin: stdLibModules.has(pkg.name)
            }))

            // 异步加载详细信息，使用 PYTHONIOENCODING 环境变量设置编码
            // packagesData.forEach(async (pkg, index) => {
            //     const detailResult = await window.electron.ipcRenderer.invoke(
            //         'run-cmd',
            //         `set PYTHONIOENCODING=utf8 && pip show ${pkg.name}`,
            //         false
            //     )
                
            //     if (detailResult.success) {
            //         const lines = detailResult.data.split('\n')
            //         const summary = lines.find(line => line.startsWith('Summary:'))?.split(': ')[1] || ''
                    
            //         // 更新单个包的详细信息
            //         packages.value[index] = {
            //             ...packages.value[index],
            //             summary
            //         }
            //     } else {
            //         // 如果获取失败，设置为空描述
            //         packages.value[index] = {
            //             ...packages.value[index],
            //             summary: ''
            //         }
            //     }
            // })
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        console.error('加载包列表失败:', error)
        ElMessage.error('加载包列表失败')
    } finally {
        loading.value = false
    }
}

// 刷新包列表
const refreshPackages = () => {
    loadPackages()
}



const currentPythonVersion = ref('')

// 添加获取Python版本的函数
async function getCurrentPythonVersion() {
    try {
        // 首先尝试使用 python --version
        let result = await window.electron.ipcRenderer.invoke('run-cmd', "python --version", false)

        if (result.success) {
            const version = parsePythonVersion(result.data)
            if (version !== '未检测到') {
                currentPythonVersion.value = version
                return
            }
        }

        // 如果上面的方法失败，尝试使用python -c打印版本
        result = await window.electron.ipcRenderer.invoke('run-cmd', 'python -c "import sys; print(sys.version.split()[0])" 2>&1', false)

        if (result.success && result.data.trim() && !result.data.includes('不是内部或外部命令')) {
            currentPythonVersion.value = result.data.trim()
            return
        }

        // 如果还是失败，尝试使用py命令(Windows Python Launcher)
        result = await window.electron.ipcRenderer.invoke('run-cmd', 'py --version 2>&1', false)

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

// 添加版本解析函数
function parsePythonVersion(output) {
    let match = output.match(/Python\s+([\d\.]+)/i)
    if (match) return match[1]

    match = output.match(/(\d+\.\d+(\.\d+)?)/i)
    if (match) return match[1]

    return '未检测到'
}

onMounted(async () => {
    await getCurrentPythonVersion()
    loadPackages()
})

// 在 script setup 部分添加卸载方法
const uninstallPackage = async (pkg) => {
    try {
        pkg.uninstalling = true
        const result = await window.electron.ipcRenderer.invoke('run-cmd', `pip uninstall -y ${pkg.name}`)
        if (result.success) {
            ElMessage.success(`成功卸载 ${pkg.name}`)
            await loadPackages() // 刷新列表
        } else {
            throw new Error(result.error)
        }
    } catch (error) {
        console.error('卸载失败:', error)
        ElMessage.error(`卸载 ${pkg.name} 失败`)
    } finally {
        pkg.uninstalling = false
    }
}



</script>

<style scoped>
.package-manage-container {
    padding: 0 20px;
    color: white;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.header-actions {
    display: flex;
    gap: 16px;
    align-items: center;
}

/* 添加版本显示相关样式 */
.version-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.version-label {
    white-space: nowrap;
}

.version-tag {
    font-size: 14px;
    font-weight: bold;
    padding: 4px 10px;
}

:deep(.el-table) {
    --el-table-bg-color: transparent;
    --el-table-tr-bg-color: transparent;
    --el-table-border-color: rgba(255, 255, 255, 0.1);
    --el-table-header-bg-color: rgba(0, 0, 0, 0.2);
    --el-table-header-text-color: white;
    --el-table-text-color: white;
    --el-table-row-hover-bg-color: transparent;
}
</style>
