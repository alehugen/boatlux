import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { finishPageLoading, startPageLoading } from '@/presentation/composables/usePageLoading'
import { useReport } from '@/presentation/composables/useReport'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'import',
    component: () => import('@/presentation/pages/ImportPage.vue'),
  },
  {
    path: '/dre',
    name: 'dre',
    component: () => import('@/presentation/pages/DrePage.vue'),
    // Sem planilha importada (ex.: depois de recarregar a página), volta para a importação.
    beforeEnter: () => (useReport().report.value ? true : { name: 'import' }),
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
      ? new Promise((resolve) => setTimeout(() => resolve({ el: to.hash, top: 152, behavior: 'smooth' }), 350))
      : { top: 0 },
  routes,
})

/** A primeira página é coberta pela tela de carregamento; as trocas seguintes mostram o indicador. */
router.beforeEach((to, from) => {
  if (from.matched.length && to.path !== from.path) startPageLoading()
})

router.afterEach((_to, _from, failure) => {
  if (failure) finishPageLoading()
})

router.onError(() => finishPageLoading())
