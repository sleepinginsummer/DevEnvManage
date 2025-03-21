<script setup>
import { ref } from 'vue'

const menuItems = ref([
  { name: 'Jdk版本控制', path: '/jdkManage' },
  { name: 'Python版本控制', path: '/pythonManage' },
  { name: '代理设置', path: '/proxySettings' },
  { name: '关于', path: '/about' }
])
</script>

<template>
  <div class="app-container">
    <!-- 左侧菜单 -->
    <div class="sidebar">
      <nav>
        <router-link v-for="item in menuItems" :key="item.path" :to="item.path" class="menu-item">
          {{ item.name }}
        </router-link>
      </nav>
    </div>

    <!-- 右侧内容区 -->
    <div class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<style>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 200px;
  background-color: var(--ev-c-black-soft);
  padding: 20px;
  border-right: 1px solid var(--ev-c-gray-1);
}

.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.menu-item {
  display: block;
  padding: 10px;
  color: var(--ev-c-text-1);
  text-decoration: none;
  border-radius: 4px;
  margin-bottom: 5px;
}

.menu-item:hover {
  background-color: var(--ev-c-gray-3);
}

.router-link-active {
  background-color: var(--ev-c-gray-2);
}
</style>
