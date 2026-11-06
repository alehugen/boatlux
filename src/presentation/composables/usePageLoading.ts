import { computed, readonly, ref } from 'vue'

/**
 * Estado de carregamento entre páginas.
 * - `pending`: da navegação até a nova página terminar de entrar (linha no cabeçalho).
 * - `swapping`: da saída da página atual até a nova começar a entrar, quando a faixa fica sem conteúdo
 *   (indicador no meio da faixa). Começa só na saída para não cobrir o conteúdo que ainda está visível.
 */
const pending = ref(false)
const swapping = ref(false)

export function startPageLoading() {
  pending.value = true
}

export function pageLeaving() {
  swapping.value = true
}

export function pageEntering() {
  swapping.value = false
}

export function finishPageLoading() {
  pending.value = false
  swapping.value = false
}

export function usePageLoading() {
  return {
    swapping: readonly(swapping),
    busy: computed(() => pending.value || swapping.value),
  }
}
