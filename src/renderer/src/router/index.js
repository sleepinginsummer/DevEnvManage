import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/about'  // 添加重定向到 jdkVersion 页面
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue')
  },
  {
    path: '/jdkManage',
    name: 'jdkManage',
    component: () => import('../views/JdkManage.vue')
  },
  {
    path: '/pythonManage',
    name: 'pythonManage',
    component: () => import('../views/PythonManage.vue')
  },
  {
    path: '/proxySettings',
    name: 'proxySettings',
    component: () => import('../views/ProxySettings.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router