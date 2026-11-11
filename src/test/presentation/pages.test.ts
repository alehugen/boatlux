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
import { dreRows, rsFile, xlsxFile } from '@/test/fixtures'
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
    page.getComponent(FileDropzone).vm.$emit('select', [xlsxFile('DRE 2026.xlsx', { 'DRE Unidades': dreRows() })])
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dre'))
  })

  it('importa as duas planilhas de uma vez e abre a DRE da primeira', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', [rsFile(), xlsxFile('DRE 2026.xlsx', { 'DRE Unidades': dreRows() })])
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dre'))
    expect(useReport().companies.value.map((c) => c.id)).toEqual(['boatlux', 'rs-nautica'])
    expect(useReport().activeId.value).toBe('rs-nautica')
  })

  it('com erro em uma das planilhas, abre as outras e fica na página mostrando o erro', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', [rsFile(), new File([], 'vazio.xlsx')])
    await vi.waitFor(() => expect(page.find('[role="alert"]').exists()).toBe(true))
    expect(router.currentRoute.value.name).toBe('import')
    expect(page.get('[role="alert"]').text()).toBe('O arquivo está vazio: vazio.xlsx')
    expect(page.text()).toContain('RS Náutica: Fechamento Financeiro 2026 - RS Náutica')
  })

  it('com erro, fica na página e mostra o erro', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', [new File([], 'vazio.xlsx')])
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
    expect(page.text()).toContain('Boatlux: DRE 2026, jan/26 a mar/26')
    expect(page.text()).toContain('Voltar para a DRE')
  })

  it('com as duas operações abertas, lista cada planilha e abre a DRE da escolhida', async () => {
    await useReport().importFile(xlsxFile('DRE 2026.xlsx', { 'DRE Unidades': dreRows() }))
    await useReport().importFile(rsFile())
    const { page } = await mountImport()
    const items = page.findAll('li').map((li) => li.text())
    expect(items[0]).toContain('Boatlux: DRE 2026')
    expect(items[1]).toContain('RS Náutica: Fechamento Financeiro 2026 - RS Náutica')
    expect(useReport().activeId.value).toBe('rs-nautica')
    await page.findAll('button').find((b) => b.text().includes('Abrir a DRE da Boatlux'))!.trigger('click')
    expect(useReport().activeId.value).toBe('boatlux')
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
