import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue')
  },
  {
    path: '/jdkVersion',
    name: 'jdkVersion',
    component: () => import('../views/JdkVersion.vue')
  },
  // 可以继续添加更多路由...
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router