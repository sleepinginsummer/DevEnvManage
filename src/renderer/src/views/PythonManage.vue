<template>
    <div class="python-manage-container">
        <div class="tab-header">
            <el-tabs v-model="activeTab" class="python-tabs" tab-position="top">
                <el-tab-pane label="Python版本管理" name="version"></el-tab-pane>
                <el-tab-pane label="Python加速域名" name="tools"></el-tab-pane>
                <el-tab-pane label="包管理" name="packages"></el-tab-pane>
            </el-tabs>
        </div>
        
        <div class="tab-content">
            <PythonVersionManage v-if="activeTab === 'version'" />
            <PythonMirrorConfig v-else-if="activeTab === 'tools'" />
            <PythonPackageManage v-else-if="activeTab === 'packages'" />
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import PythonVersionManage from './PythonVersionManage.vue'
import PythonMirrorConfig from './PythonMirrorConfig.vue'
import PythonPackageManage from './PythonPackageManage.vue'

const activeTab = ref('version')
</script>

<style scoped>
.python-manage-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: white; /* 添加默认白色字体 */
}

.tab-header {
    padding-top: 10px;
    background-color: inherit;
    z-index: 10;
}

.tab-content {
    flex: 1;
    overflow: auto;
    padding: 15px 0;
}

.python-tabs {
    width: 100%;
}

:deep(.el-tabs__item) {
    color: rgba(255, 255, 255, 0.7); /* 未选中的tab文字颜色 */
    font-size: 16px; /* 增大字体大小 */
}

:deep(.el-tabs__item.is-active) {
    color: white; /* 选中的tab文字颜色 */
    font-weight: bold; /* 加粗选中的标签 */
}

.empty-tab {
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>