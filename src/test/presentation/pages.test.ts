import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useReport } from '@/presentation/composables/useReport'
import RankingBarChart from '@/presentation/components/RankingBarChart.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import ImportPage from '@/presentation/pages/ImportPage.vue'
import NotFoundPage from '@/presentation/pages/NotFoundPage.vue'
import { routes } from '@/presentation/router'
import { dreRows, xlsxFile } from '@/test/fixtures'
import { mountWithProviders } from './mountWithProviders'

const stubs = { RouterLink: RouterLinkStub }

beforeEach(() => setActivePinia(createPinia()))

describe('rotas', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  it.each([
    ['/', 'import'],
    ['/qualquer/coisa', 'not-found'],
  ])('%s → %s', (path, name) => {
    expect(router.resolve(path).name).toBe(name)
  })

  it('sem planilha importada, a DRE volta para a importação', async () => {
    await router.push('/dre')
    expect(router.currentRoute.value.name).toBe('import')

    await useReport().importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))
    await router.push('/dre')
    expect(router.currentRoute.value.name).toBe('dre')
  })
})

describe('NotFoundPage', () => {
  it('oferece caminhos de volta', () => {
    const links = mountWithProviders(NotFoundPage, { global: { stubs } }).findAllComponents(RouterLinkStub)
    expect(links.map((link) => link.props('to'))).toEqual([{ name: 'import' }])
  })
})

describe('ImportPage', () => {
  async function mountImport() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    const page = mountWithProviders(ImportPage, { global: { stubs, plugins: [router] } })
    return { page, router }
  }

  it('abre direto a DRE quando a planilha é importada sem erros', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', xlsxFile('DRE 2026.xlsx', { 'DRE Unidades': dreRows() }))
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dre'))
  })

  it('com erro, fica na página e mostra o erro', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', new File([], 'vazio.xlsx'))
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('import')
    expect(page.get('[role="alert"]').text()).toBe('O arquivo está vazio: vazio.xlsx')

    page.vm.$.appContext.app.unmount()
    const again = mountWithProviders(ImportPage, { global: { stubs } })
    expect(again.find('[role="alert"]').exists()).toBe(false)
  })

  it('com uma planilha aberta, oferece voltar para a DRE', async () => {
    await useReport().importFile(xlsxFile('DRE 2026.xlsx', { 'DRE Unidades': dreRows() }))
    const { page } = await mountImport()
    expect(page.text()).toContain('Planilha aberta: DRE 2026, jan/26 a mar/26')
    expect(page.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'dre' })
  })
})

describe('gráficos sem dados', () => {
  it.each([
    ['ranking', RankingBarChart, { items: [], valueLabel: 'Valor' }],
    ['evolução', TrendChart, { categories: ['jan/26'], series: [{ name: 'Receita', type: 'bar', data: [0] }] }],
  ])('%s mostra um aviso em vez de um gráfico vazio', (_, component, props) => {
    const wrapper = mountWithProviders(component, { props: props as never })
    expect(wrapper.text()).toContain('Sem dados para exibir')
  })
})
