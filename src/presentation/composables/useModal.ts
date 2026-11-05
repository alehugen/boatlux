import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

export const MODAL_CLOSE_DURATION = 260

type Focusable = { focus(): void } | null | undefined

interface ModalOptions {
  focusOnOpen: () => Focusable
  focusOnClose?: () => Focusable
  onEscape?: () => void
}

const openModals: symbol[] = []
let pageOverflow = ''

function setAppInert(inert: boolean) {
  const app = document.getElementById('app')
  if (app) app.inert = inert
}

function lockPage(id: symbol) {
  if (openModals.includes(id)) return
  if (!openModals.length) {
    pageOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setAppInert(true)
  }
  openModals.push(id)
}

function unlockPage(id: symbol) {
  const index = openModals.indexOf(id)
  if (index < 0) return
  openModals.splice(index, 1)
  if (openModals.length) return
  document.body.style.overflow = pageOverflow
  setAppInert(false)
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function useModal(options: ModalOptions) {
  const id = Symbol('modal')
  const state = ref<'closed' | 'open' | 'closing'>('closed')
  const visible = computed(() => state.value !== 'closed')
  const depth = ref(0)
  const zIndex = computed(() => `calc(var(--layer-modal) + ${depth.value})`)
  let returnFocus: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  async function open() {
    if (state.value === 'open') return
    clearTimeout(timer)
    if (state.value === 'closed') returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    state.value = 'open'
    lockPage(id)
    depth.value = openModals.indexOf(id)
    await nextTick()
    options.focusOnOpen()?.focus()
  }

  function close() {
    if (state.value !== 'open') return
    state.value = 'closing'
    timer = setTimeout(finishClosing, prefersReducedMotion() ? 0 : MODAL_CLOSE_DURATION)
  }

  async function finishClosing() {
    state.value = 'closed'
    unlockPage(id)
    await nextTick()
    ;(options.focusOnClose?.() ?? returnFocus)?.focus()
    returnFocus = null
  }

  useEventListener('keydown', (event: KeyboardEvent) => {
    const inPopup = event.target instanceof Element && event.target.closest('[role="listbox"], [role="menu"], [data-reka-popper-content-wrapper]')
    if (event.key !== 'Escape' || state.value !== 'open' || event.defaultPrevented || inPopup) return
    if (openModals.at(-1) !== id) return
    ;(options.onEscape ?? close)()
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    unlockPage(id)
  })

  return { state, visible, zIndex, open, close }
}
