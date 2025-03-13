import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/jdkManage'  // 添加重定向到 jdkVersion 页面
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue')
  },
  {
    path: '/jdkManage',
    name: 'jdkManage',
    component: () => import('../views/jdkManage.vue')
  },
  {
    path: '/pythonManage',
    name: 'pythonManage',
    component: () => import('../views/pythonManage.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router