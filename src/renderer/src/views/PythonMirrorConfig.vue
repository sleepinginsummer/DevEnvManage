<template>
    <div class="mirror-config-container">

        <!-- 新增当前全局配置显示框 -->
        <div class="current-config-section">
    <div class="section-header">
        <h3>当前系统配置</h3>
        <el-button size="small" type="primary" @click="queryCurrentConfig">刷新配置信息</el-button>
    </div>
    <el-card class="config-card" v-loading="configLoading">
                <template v-if="currentConfig.indexUrl || currentConfig.trustedHost">
                    <div class="config-item" v-if="currentConfig.indexUrl">
                        <span class="config-label">全局镜像源:</span>
                        <span class="config-value">{{ currentConfig.indexUrl }}</span>
                    </div>
                    <div class="config-item" v-if="currentConfig.trustedHost">
                        <span class="config-label">信任主机:</span>
                        <span class="config-value">{{ currentConfig.trustedHost }}</span>
                    </div>
                </template>
                <template v-else>
                    <div class="no-config">{{ configLoading ? '加载中...' : '未查询到配置信息或尚未配置全局镜像' }}</div>
                </template>
            </el-card>
        </div>


        <div class="header-section">
            <p class="description">配置pip安装包时使用的全局镜像源，加快下载速度</p>
        </div>

        <div class="mirrors-list">
            <el-table :data="mirrors" style="width: 100%">
                <el-table-column label="状态" width="80">
                    <template #default="scope">
                        <el-tag :type="scope.row.isDefault ? 'success' : 'info'">
                            {{ scope.row.isDefault ? '默认' : '备选' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="name" label="名称" width="180" />
                <el-table-column prop="url" label="镜像地址" />
                <el-table-column label="操作" width="200">
                    <template #default="scope">
                        <el-button v-if="!scope.row.isDefault" type="primary" size="small"
                            @click="setAsGlobal(scope.row)">
                            设为全局
                        </el-button>
                        <el-button type="danger" size="small" :disabled="scope.row.isDefault || mirrors.length <= 1"
                            @click="removeMirror(scope.$index)">
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <div class="add-mirror-form">
            <h3>添加新镜像源</h3>
            <el-form :model="newMirror" :rules="rules" ref="mirrorForm" label-width="100px">
                <el-form-item label="名称" prop="name">
                    <el-input v-model="newMirror.name" placeholder="例如：阿里云镜像" />
                </el-form-item>
                <el-form-item label="镜像地址" prop="url">
                    <el-input v-model="newMirror.url" placeholder="例如：https://mirrors.aliyun.com/pypi/simple" />
                </el-form-item>
                <el-form-item label="信任主机" prop="trustedHost">
                    <el-input v-model="newMirror.trustedHost" placeholder="例如：mirrors.aliyun.com" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="addMirror">添加镜像源</el-button>
                </el-form-item>
            </el-form>
        </div>

        <div class="usage-info">
            <h3>pip 命令示例</h3>
            <div class="command-section">
                <el-input v-model="packageName" placeholder="输入包名" size="small"
                    style="max-width: 200px; margin-right: 10px;" />
                <div class="command-example">
                    <code>pip install {{ packageName }} -i {{ defaultMirrorUrl }} --trusted-host {{ defaultTrustedHost }}</code>
                    <el-button size="small" type="primary" class="copy-btn" @click="copyCommand">复制</el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
const packageName = ref('package-name')
// 镜像源列表
const mirrors = ref([
    {
        name: '阿里云镜像',
        url: 'https://mirrors.aliyun.com/pypi/simple',
        trustedHost: 'mirrors.aliyun.com',
        isDefault: true
    },
    {
        name: '清华大学镜像',
        url: 'https://pypi.tuna.tsinghua.edu.cn/simple',
        trustedHost: 'pypi.tuna.tsinghua.edu.cn',
        isDefault: false
    },
    {
        name: '中国科技大学镜像',
        url: 'https://pypi.mirrors.ustc.edu.cn/simple',
        trustedHost: 'pypi.mirrors.ustc.edu.cn',
        isDefault: false
    },
    {
        name: '腾讯云镜像',
        url: 'https://mirrors.cloud.tencent.com/pypi/simple',
        trustedHost: 'mirrors.cloud.tencent.com',
        isDefault: false
    },
    {
        name: '豆瓣镜像',
        url: 'https://pypi.doubanio.com/simple',
        trustedHost: 'pypi.doubanio.com',
        isDefault: false
    }
])
// 当前系统配置 - 确保初始化为有效对象
const currentConfig = ref({
    indexUrl: '',
    trustedHost: ''
})
const configLoading = ref(false)
// 新镜像表单
const newMirror = ref({
    name: '',
    url: '',
    trustedHost: '',
    isDefault: false
})

// 表单规则
const rules = {
    name: [
        { required: true, message: '请输入镜像名称', trigger: 'blur' },
        { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
    ],
    url: [
        { required: true, message: '请输入镜像地址', trigger: 'blur' },
        { pattern: /^https?:\/\//, message: '镜像地址必须以http://或https://开头', trigger: 'blur' }
    ],
    trustedHost: [
        { required: true, message: '请输入信任主机', trigger: 'blur' }
    ]
}

const mirrorForm = ref(null)

// 计算属性：默认镜像URL
const defaultMirrorUrl = computed(() => {
    const defaultMirror = mirrors.value.find(m => m.isDefault)
    return defaultMirror ? defaultMirror.url : ''
})

// 计算属性：默认信任主机
const defaultTrustedHost = computed(() => {
    const defaultMirror = mirrors.value.find(m => m.isDefault)
    return defaultMirror ? defaultMirror.trustedHost : ''
})

// 设置全局镜像
const setAsGlobal = async (mirror) => {
    const loadingInstance = ElLoading.service({
        lock: true,
        text: '正在设置全局镜像源...',
        background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
        // 设置为默认镜像（本地状态）
        mirrors.value.forEach(m => {
            m.isDefault = false
        })
        mirror.isDefault = true
        saveMirrors()

        // 执行pip命令设置全局镜像
        const setIndexUrlCmd = `pip config set global.index-url ${mirror.url}`
        const setTrustedHostCmd = `pip config set install.trusted-host ${mirror.trustedHost}`

        // 执行命令
        const result1 = await window.electron.ipcRenderer.invoke('run-cmd', setIndexUrlCmd)
        const result2 = await window.electron.ipcRenderer.invoke('run-cmd', setTrustedHostCmd)

        if (result1.success && result2.success) {
            ElMessage.success(`已将 ${mirror.name} 设为全局镜像源`)
        } else {
            ElMessage.error('设置全局镜像源失败，请检查 pip 是否正确安装')
            console.error('设置镜像源失败:', result1.error || result2.error)
        }
    } catch (error) {
        ElMessage.error('设置全局镜像源时发生错误')
        console.error('设置镜像源错误:', error)
    } finally {
        loadingInstance.close()
    }
}

// 添加新镜像
const addMirror = () => {
    mirrorForm.value.validate((valid) => {
        if (valid) {
            // 检查是否已存在相同URL的镜像
            if (mirrors.value.some(m => m.url === newMirror.value.url)) {
                ElMessage.warning('该镜像地址已存在')
                return
            }

            // 如果是第一个镜像，设为默认
            if (mirrors.value.length === 0) {
                newMirror.value.isDefault = true
            }

            mirrors.value.push({ ...newMirror.value })
            saveMirrors()
            ElMessage.success('添加镜像源成功')

            // 重置表单
            newMirror.value = {
                name: '',
                url: '',
                trustedHost: '',
                isDefault: false
            }
            mirrorForm.value.resetFields()
        } else {
            ElMessage.error('请正确填写表单')
        }
    })
}

// 删除镜像
const removeMirror = (index) => {
    const mirror = mirrors.value[index]
    if (mirror.isDefault) {
        ElMessage.warning('不能删除默认镜像源')
        return
    }

    mirrors.value.splice(index, 1)
    saveMirrors()
    ElMessage.success('删除镜像源成功')
}

// 复制命令
const copyCommand = () => {
    const command = `pip install ${packageName.value} -i ${defaultMirrorUrl.value} --trusted-host ${defaultTrustedHost.value}`
    navigator.clipboard.writeText(command)
        .then(() => {
            ElMessage.success('命令已复制到剪贴板')
        })
        .catch(() => {
            ElMessage.error('复制失败，请手动复制')
        })
}

// 保存镜像配置到文件
const saveMirrors = async () => {
    try {
        await window.electron.ipcRenderer.invoke('save-to-file', {
            filePath: 'python-mirrors.json',
            data: JSON.stringify(mirrors.value, null, 2)
        })
        console.log('镜像配置已保存到文件')
    } catch (error) {
        console.error('保存镜像配置失败:', error)
        ElMessage.error('保存镜像配置失败')
    }
}

// 从文件加载镜像配置
const loadMirrors = async () => {
    try {
        const result = await window.electron.ipcRenderer.invoke('load-from-file', {
            filePath: 'python-mirrors.json'
        })

        if (result.success && result.data) {
            mirrors.value = JSON.parse(result.data)

            // 确保至少有一个默认镜像
            if (!mirrors.value.some(m => m.isDefault) && mirrors.value.length > 0) {
                mirrors.value[0].isDefault = true
            }
        }
    } catch (error) {
        console.error('加载镜像配置失败:', error)
        // 使用默认配置
        console.log('使用默认镜像配置')
    }
}

// 查询当前系统配置的全局镜像参数
const queryCurrentConfig = async () => {
    configLoading.value = true
    currentConfig.value = {
        indexUrl: '',
        trustedHost: ''
    }

    try {
        // 查询全局镜像源
        const indexUrlResult = await window.electron.ipcRenderer.invoke('run-cmd', 'pip config get global.index-url')
        // Add this line for debug inf
        if (indexUrlResult.success && indexUrlResult.data) {
            // 移除可能存在的引号和多余空格
            currentConfig.value.indexUrl = indexUrlResult.data.trim().replace(/^['"]|['"]$/g, '')
        }

        // 查询信任主机
        const trustedHostResult = await window.electron.ipcRenderer.invoke('run-cmd', 'pip config get install.trusted-host')
        if (trustedHostResult.success && trustedHostResult.data) {
            // 移除可能存在的引号和多余空格
            currentConfig.value.trustedHost = trustedHostResult.data.trim().replace(/^['"]|['"]$/g, '')
        }
        console.log('查询到的全局镜像源:', currentConfig.value.indexUrl)
        console.log('查询到的信任主机:', currentConfig.value.trustedHost)
        if (!currentConfig.value.indexUrl && !currentConfig.value.trustedHost) {
            // ElMessage.info('未查询到全局镜像配置')
        } else {
            // 添加成功提示
            // ElMessage.success('配置信息已更新')
        }
    } catch (error) {
        console.error('查询全局镜像配置失败:', error)
        ElMessage.error('查询全局镜像配置失败')
    } finally {
        configLoading.value = false
    }
}

// 组件挂载时加载配置
onMounted(async () => {
    await loadMirrors()
    await queryCurrentConfig() // 初始加载时查询当前配置
})
</script>

<style scoped>
.mirror-config-container {
    padding: 0 20px;
    color: white;
}

.header-section {
    margin-bottom: 20px;
}

.description {
    color: rgba(255, 255, 255, 0.7);
    margin-top: 5px;
}

.mirrors-list {
    margin-bottom: 30px;
}

.add-mirror-form {
    margin-bottom: 30px;
    max-width: 600px;
}

.usage-info {
    /* margin-top: 20px;
    padding: 15px; */
    /* background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px; */
}

.command-section {
    margin-top: 15px;
}

.command-example {
    display: flex;
    align-items: center;
    margin-top: 10px;
}

.command-example code {
    flex: 1;
    background-color: #ffffff;
    color: #333333;
    padding: 8px 12px;
    border-radius: 4px;
    word-break: break-all;
    margin-right: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.current-config-section {
    margin-top: 30px;
}

.config-card {
    margin-top: 15px;
    background-color: rgba(0, 0, 0, 0.2);
    color: white;
}

.config-item {
    margin: 10px 0;
}

.config-label {
    font-weight: bold;
    margin-right: 10px;
}

.config-value {
    word-break: break-all;
}

.no-config {
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
}

:deep(.el-table) {
    --el-table-bg-color: transparent;
    --el-table-tr-bg-color: transparent;
    --el-table-border-color: rgba(255, 255, 255, 0.1);
    --el-table-header-bg-color: rgba(0, 0, 0, 0.2);
    --el-table-header-text-color: white;
    --el-table-text-color: white;
    --el-table-row-hover-bg-color: transparent;  /* 添加这一行，取消悬浮效果 */
}

:deep(.el-card) {
    --el-card-bg-color: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-form-item__label) {
    color: white;
}

.copy-btn {
    margin-left: 15px;
    /* 添加左侧间距 */
}

.section-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
}

.section-header h3 {
    margin: 0;
}
</style>