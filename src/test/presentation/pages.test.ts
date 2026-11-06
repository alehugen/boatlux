import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { container } from '@/infrastructure/container'
import RankingBarChart from '@/presentation/components/RankingBarChart.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import ImportPage from '@/presentation/pages/ImportPage.vue'
import NotFoundPage from '@/presentation/pages/NotFoundPage.vue'
import { routeForReport, routes } from '@/presentation/router'
import { dreRows, xlsxFile } from '@/test/fixtures'
import { mountWithProviders } from './mountWithProviders'

const stubs = { RouterLink: RouterLinkStub }

beforeEach(async () => {
  setActivePinia(createPinia())
  for (const report of await container.listReports.execute()) await container.removeReport.execute(report.id)
})

describe('rotas', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  it.each([
    ['/', 'import'],
    ['/dre/123', 'dre'],
    ['/qualquer/coisa', 'not-found'],
  ])('%s → %s', (path, name) => {
    expect(router.resolve(path).name).toBe(name)
  })

  it('leva a DRE para a sua página', async () => {
    const [dre] = await container.importFile.execute(xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() }))
    expect(routeForReport(dre!)).toEqual({ name: 'dre', params: { id: dre!.id } })
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

  it('abre direto a DRE quando uma planilha é importada sem erros', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', [xlsxFile('DRE 2026.xlsx', { 'DRE Geral': dreRows() })])
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dre'))
  })

  it('com erro, fica na página, mostra o erro e lista a DRE com o resultado do último mês', async () => {
    const { page, router } = await mountImport()
    page.getComponent(FileDropzone).vm.$emit('select', [
      xlsxFile('DRE 2026.xlsx', { 'DRE Geral': dreRows() }),
      new File([], 'vazio.xlsx'),
    ])
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('import')
    expect(page.get('[role="alert"]').text()).toBe('O arquivo está vazio: vazio.xlsx')
    const row = page.get('li')
    expect(row.text()).toContain('DRE 2026')
    expect(row.text()).toContain('jan/26 a mar/26, 3 meses')
    expect(row.text()).toContain('No vermelho em mar/26')

    await row.get('button[aria-label="Remover DRE 2026"]').trigger('click')
    await flushPromises()
    expect(page.text()).toContain('Nenhuma DRE importada ainda.')

    page.vm.$.appContext.app.unmount()
    const again = mountWithProviders(ImportPage, { global: { stubs } })
    expect(again.find('[role="alert"]').exists()).toBe(false)
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
