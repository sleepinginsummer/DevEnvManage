<template>
  <div class="proxy-settings-page">
    <h1>代理设置</h1>
    <div class="proxy-settings-container">
      <p>设置代理可以加速 Python、JDK 等下载安装过程。</p>
      <el-form :model="proxyForm" label-width="120px">
        <el-form-item label="代理地址">
          <el-input v-model="proxyForm.host" placeholder="例如: 127.0.0.1"></el-input>
        </el-form-item>
        <el-form-item label="代理端口">
          <el-input v-model="proxyForm.port" placeholder="例如: 7890"></el-input>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="proxyForm.enabled">启用代理</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveProxySettings">保存设置</el-button>
          <el-button @click="resetProxySettings">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

// 代理设置表单
const proxyForm = ref({
  host: '',
  port: '',
  enabled: false
})

// 加载保存的代理设置
onMounted(() => {
  loadProxySettings()
})

// 加载代理设置
function loadProxySettings() {
  proxyForm.value.host = localStorage.getItem('cmdProxyHost') || ''
  proxyForm.value.port = localStorage.getItem('cmdProxyPort') || ''
  proxyForm.value.enabled = localStorage.getItem('cmdProxyEnabled') === 'true'
}

// 保存代理设置
function saveProxySettings() {
  // 保存到本地存储
  localStorage.setItem('cmdProxyHost', proxyForm.value.host)
  localStorage.setItem('cmdProxyPort', proxyForm.value.port)
  localStorage.setItem('cmdProxyEnabled', proxyForm.value.enabled.toString())

  // 显示成功消息
  ElMessage.success('代理设置已保存')
}

// 重置代理设置
function resetProxySettings() {
  loadProxySettings()
  ElMessage.info('已重置为上次保存的设置')
}
</script>

<style scoped>
.proxy-settings-page {
  padding: 20px;
}

.proxy-settings-container {
  max-width: 600px;
  margin: 20px auto;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}

p {
  margin-bottom: 20px;
  color: #666;
}
</style>