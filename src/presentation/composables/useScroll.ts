import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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
