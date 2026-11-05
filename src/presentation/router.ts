import { createRouter, createWebHistory, type RouteLocationRaw, type RouteRecordRaw } from 'vue-router'
import type { Report } from '@/domain/report'

export const routeForReport = (report: Report): RouteLocationRaw => ({ name: 'dre', params: { id: report.id } })

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'import',
    component: () => import('@/presentation/pages/ImportPage.vue'),
  },
  {
    path: '/dre/:id',
    name: 'dre',
    component: () => import('@/presentation/pages/DrePage.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/presentation/pages/NotFoundPage.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to) =>
    to.hash
      ? new Promise((resolve) => setTimeout(() => resolve({ el: to.hash, top: 88, behavior: 'smooth' }), 350))
      : { top: 0 },
  routes,
})
