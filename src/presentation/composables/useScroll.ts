import { nextTick, onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

const SECTION_OFFSET = 140
const SCROLL_LOCK_FALLBACK_MS = 1200

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

export function useScrollSpy(ids: MaybeRefOrGetter<readonly string[]>) {
  const activeId = ref<string | null>(null)
  let scrollingTo: string | null = null

  const sectionInView = () => {
    const list = toValue(ids)
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atBottom) return list.at(-1) ?? null

    return list.reduce<string | null>((current, id) => {
      const top = document.getElementById(id)?.getBoundingClientRect().top
      return top !== undefined && top - SECTION_OFFSET <= 0 ? id : current
    }, list[0] ?? null)
  }

  const update = () => {
    if (!scrollingTo) activeId.value = sectionInView()
  }

  onWindowScroll(update)
  watch(() => toValue(ids), () => nextTick(update))

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
