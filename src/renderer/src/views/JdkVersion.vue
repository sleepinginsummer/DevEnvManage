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

<style scoped>
.jdk-version {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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