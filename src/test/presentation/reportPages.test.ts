import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { container } from '@/infrastructure/container'
import PeriodSelect, { type PeriodGroup } from '@/presentation/components/PeriodSelect.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import { useReports } from '@/presentation/composables/useReports'
import DrePage from '@/presentation/pages/DrePage.vue'
import { dreRows, xlsxFile } from '@/test/fixtures'
import { mountWithProviders } from './mountWithProviders'

const stubs = {
  RouterLink: RouterLinkStub,
  TrendChart: true,
  RankingBarChart: true,
}

beforeEach(async () => {
  setActivePinia(createPinia())
  for (const report of await container.listReports.execute()) await container.removeReport.execute(report.id)
})

async function importAll(files: File[]) {
  for (const file of files) await container.importFile.execute(file)
  await useReports().refresh()
}

describe('DrePage', () => {
  async function mountDre() {
    await importAll([xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() })])
    const page = mountWithProviders(DrePage, {
      props: { id: useReports().reports.value[0]!.id },
      global: { stubs },
    })
    await flushPromises()
    return page
  }

  it('deixa o período na navegação, que acompanha a rolagem, e começa no último mês', async () => {
    const page = await mountDre()
    const select = page.getComponent(PeriodSelect)
    expect(page.get('nav[aria-label="Seções da página"]').element.contains(select.element)).toBe(true)
    expect(page.get('header').text()).not.toContain('Período')
    expect(select.props('modelValue')).toBe('m:2')
    expect(select.props('groups').map((group: PeriodGroup) => group.options.map((o) => o.label))).toEqual([
      ['mar/26', 'fev/26', 'jan/26'],
      ['Acumulado 2026'],
    ])
  })

  it('recalcula a página ao trocar para o acumulado do ano', async () => {
    const page = await mountDre()
    page.getComponent(PeriodSelect).vm.$emit('update:modelValue', 'y:2026')
    await flushPromises()
    expect(page.text()).toContain('Resultado acumulado de 2026')
    expect(page.getComponent(ProfitTarget).props('reference')).toBe('na média mensal de 2026')
  })

  it('oferece as receitas da DRE na meta de lucro e usa a escolhida como receita bruta', async () => {
    const page = await mountDre()
    const target = page.getComponent(ProfitTarget)
    expect(target.props('revenueOptions').map((o: { label: string }) => o.label)).toEqual(['Receita bruta', 'Serviços', 'Produtos'])
    expect(target.props('base').revenue).toBe(900)

    const products = target.props('revenueOptions').find((o: { label: string }) => o.label === 'Produtos')!
    target.vm.$emit('update:revenue', products.value)
    await flushPromises()
    expect(page.getComponent(ProfitTarget).props('base')).toMatchObject({ revenue: 600, revenueLabel: 'Produtos', excludedRevenue: 300 })
  })

  it('não mostra mais a cascata nem os gráficos de receita, EBITDA e margens', async () => {
    const page = await mountDre()
    for (const title of ['Da receita ao resultado', 'Receita e EBITDA', 'Margens']) expect(page.text()).not.toContain(title)
    expect(page.findAll('nav[aria-label="Seções da página"] a').map((a) => a.text())).not.toContain('Receita e margens')
  })

  it('mostra que a DRE não foi encontrada', () => {
    const page = mountWithProviders(DrePage, { props: { id: 'nao-existe' }, global: { stubs } })
    expect(page.text()).toContain('DRE não encontrada.')
  })
})

