import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { MODAL_CLOSE_DURATION, useModal } from '@/presentation/composables/useModal'

const app = () => document.getElementById('app')!
const afterClosing = () => new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_DURATION + 40))

function mountModal() {
  const closeButton = ref<HTMLButtonElement | null>(null)
  let modal!: ReturnType<typeof useModal>
  const Host = defineComponent({
    setup() {
      modal = useModal({ focusOnOpen: () => closeButton.value })
      return () => h('div', [h('button', { id: 'gatilho' }, 'abrir'), h('button', { ref: closeButton }, 'fechar')])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, modal: () => modal }
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useModal', () => {
  it('bloqueia o restante da página enquanto aberto e devolve o foco ao fechar', async () => {
    const { wrapper, modal } = mountModal()
    const trigger = wrapper.get<HTMLButtonElement>('#gatilho').element
    trigger.focus()

    await modal().open()
    expect(app().inert).toBe(true)
    expect(document.activeElement?.textContent).toBe('fechar')

    modal().close()
    expect(modal().state.value).toBe('closing')
    await afterClosing()
    await flushPromises()
    expect(modal().state.value).toBe('closed')
    expect(app().inert).toBe(false)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('libera a página se o componente sair da tela com o modal aberto', async () => {
    const { wrapper, modal } = mountModal()
    await modal().open()
    wrapper.unmount()
    expect(app().inert).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('continua aberto quando é reaberto durante a animação de fechamento', async () => {
    const { wrapper, modal } = mountModal()
    await modal().open()
    modal().close()
    await modal().open()
    await afterClosing()
    expect(modal().state.value).toBe('open')
    expect(app().inert).toBe(true)
    wrapper.unmount()
  })

  it('fecha pelo Esc, mas não quando o Esc é de uma lista aberta', async () => {
    const { wrapper, modal } = mountModal()
    await modal().open()
    const listbox = document.body.appendChild(document.createElement('div'))
    listbox.setAttribute('role', 'listbox')
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(modal().state.value).toBe('open')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(modal().state.value).toBe('closing')
    wrapper.unmount()
  })

  it('com um modal sobre outro, o Esc fecha só o de cima e a página continua bloqueada', async () => {
    const below = mountModal()
    const above = mountModal()
    await below.modal().open()
    await above.modal().open()
    expect(above.modal().zIndex.value).toBe('calc(var(--layer-modal) + 1)')
    expect(below.modal().zIndex.value).toBe('calc(var(--layer-modal) + 0)')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(above.modal().state.value).toBe('closing')
    expect(below.modal().state.value).toBe('open')
    await afterClosing()
    await flushPromises()
    expect(app().inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(below.modal().state.value).toBe('closing')
    await afterClosing()
    await flushPromises()
    expect(app().inert).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    above.wrapper.unmount()
    below.wrapper.unmount()
  })
})
