import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { container } from '@/infrastructure/container'
import RankingBarChart from '@/presentation/components/RankingBarChart.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import { useFileImport } from '@/presentation/composables/useFileImport'
import { useReports } from '@/presentation/composables/useReports'
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
  it('resume a importação, lista a DRE e esconde do resumo relatórios removidos', async () => {
    const page = mountWithProviders(ImportPage, { global: { stubs } })
    await useFileImport().importFiles([xlsxFile('DRE 2026.xlsx', { 'DRE Geral': dreRows() }), new File([], 'vazio.xlsx')])
    await flushPromises()

    expect(page.get('[role="status"]').text()).toContain('DRE 2026')
    expect(page.get('[role="alert"]').text()).toBe('O arquivo está vazio: vazio.xlsx')
    expect(page.text()).toContain('3 meses, de jan/26 a mar/26')

    const { reports, remove } = useReports()
    await remove(reports.value[0]!.id)
    await flushPromises()
    expect(page.find('[role="status"]').exists()).toBe(false)
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
