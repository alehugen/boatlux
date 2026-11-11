import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

function onWindowScroll(handler: () => void) {
  let frame = 0
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), handler()))
  }
  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    void nextTick(handler)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })
}

export function useScrolled(threshold = 4) {
  const scrolled = ref(false)
  onWindowScroll(() => (scrolled.value = window.scrollY > threshold))
  return scrolled
}


/** Fica `true` quando o elemento já passou por baixo do cabeçalho fixo (altura `offset`, em px). */
export function useScrolledPast(target: () => HTMLElement | null | undefined, offset = 72) {
  const past = ref(false)
  onWindowScroll(() => {
    const element = target()
    past.value = !!element && window.scrollY > 0 && element.getBoundingClientRect().bottom < offset
  })
  return past
}

/** Sem o evento scrollend, libera o destaque depois deste tempo (rolagens longas passam de 1 s). */
const SCROLL_LOCK_FALLBACK_MS = 1600

/** A rolagem suave pode parar alguns pixels antes (visto no celular): conta como chegada. */
const ARRIVAL_TOLERANCE_PX = 8

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Qual seção está na tela, para destacar no menu: a última cujo topo já chegou à área fixa do topo.
 * A altura dessa área é a mesma que o navegador usa ao pular para a seção: o `scroll-padding-top` da página
 * (cabeçalho e barra fixa) mais o `scroll-margin-top` da seção.
 * Ao clicar no menu, a seção escolhida fica destacada até a rolagem terminar.
 */
export function useScrollSpy(ids: () => readonly string[]) {
  const activeId = ref<string | null>(null)
  let scrollingTo: string | null = null

  const sectionInView = () => {
    const list = ids()
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atBottom && window.scrollY > 0) return list.at(-1) ?? null
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    return list.reduce<string | null>((current, id) => {
      const section = document.getElementById(id)
      if (!section) return current
      const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0
      return section.getBoundingClientRect().top - padding - margin <= ARRIVAL_TOLERANCE_PX ? id : current
    }, list[0] ?? null)
  }

  const update = () => {
    if (!scrollingTo) activeId.value = sectionInView()
  }

  onWindowScroll(update)
  watch(ids, () => nextTick(update))

  function scrollTo(id: string) {
    const section = document.getElementById(id)
    if (!section) return
    activeId.value = id
    scrollingTo = id
    const release = () => {
      if (scrollingTo !== id) return
      scrollingTo = null
      update()
    }
    window.addEventListener('scrollend', release, { once: true })
    setTimeout(release, SCROLL_LOCK_FALLBACK_MS)
    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }

  return { activeId, scrollTo }
}
