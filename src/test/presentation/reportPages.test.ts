import { flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BasisSelect from '@/presentation/components/BasisSelect.vue'
import DebtsCard from '@/presentation/components/DebtsCard.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import PeriodSelect, { type PeriodGroup } from '@/presentation/components/PeriodSelect.vue'
import OutsideEntries from '@/presentation/components/OutsideEntries.vue'
import StockCard from '@/presentation/components/StockCard.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import RevenueBar from '@/presentation/components/RevenueBar.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import { useReport } from '@/presentation/composables/useReport'
import DrePage from '@/presentation/pages/DrePage.vue'
import { boatluxFile, dreRows, xlsxFile } from '@/test/fixtures'
import { mountWithProviders } from './mountWithProviders'

const stubs = {
  RouterLink: RouterLinkStub,
  TrendChart: true,
  RankingBarChart: true,
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.restoreAllMocks())

describe('DrePage', () => {
  async function mountDre() {
    await useReport().importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))
    const page = mountWithProviders(DrePage, {
      global: { stubs },
    })
    await flushPromises()
    return page
  }

  it('abre no último mês, com período, resultado e a divisão da receita na faixa do topo', async () => {
    const page = await mountDre()
    const band = page.get('section.bg-band')
    const select = page.getComponent(PeriodSelect)
    expect(band.element.contains(select.element)).toBe(true)
    expect(select.props('modelValue')).toBe('m:2026-03')
    expect(select.props('groups').map((group: PeriodGroup) => group.options.map((o) => o.label))).toEqual([
      ['mar/26', 'fev/26', 'jan/26'],
      ['Acumulado 2026'],
    ])
    expect(band.get('h1').text()).toBe('Resultado de março de 2026')
    expect(band.text()).toContain('No vermelho')
    expect(band.getComponent(RevenueBar).props('flow')).toMatchObject({ revenue: 900, result: -70 })
  })

  it('mostra os indicadores em cards e a barra fixa só depois de rolar', async () => {
    const page = await mountDre()
    const section = page.get('#indicadores').element
    const cards = page.findAllComponents(StatCard).filter((card) => section.contains(card.element))
    expect(cards.map((card) => card.props('label'))).toEqual([
      'Receita bruta',
      'Lucro bruto',
      'Margem de contribuição',
      'EBITDA',
      'Resultado líquido',
      'Saldo de caixa',
    ])
    expect(page.findAllComponents(PeriodSelect)).toHaveLength(1)
  })

  it('tem um menu com as seções da página, cada uma ligada à sua seção', async () => {
    const page = await mountDre()
    const links = page.findAll('nav[aria-label="Seções da página"] a')
    expect(links.map((link) => link.text())).toEqual([
      'Indicadores',
      'Pontos de análise',
      'Meta de lucro',
      'Custos e receita',
      'Saldo de caixa',
      'DRE completa',
    ])
    for (const link of links) expect(page.find(link.attributes('href')!).exists()).toBe(true)
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
  })

  it('sem fluxo de caixa com fórmulas, não oferece regime nem mostra dívidas e estoque', async () => {
    const page = await mountDre()
    expect(page.findComponent(BasisSelect).exists()).toBe(false)
    expect(page.find('#dividas-estoque').exists()).toBe(false)
  })

  it('não mostra nada sem planilha importada', () => {
    const page = mountWithProviders(DrePage, { global: { stubs } })
    expect(page.text()).toBe('')
  })
})


describe('DrePage com a planilha da Boatlux', () => {
  async function mountBoatlux() {
    await useReport().importFile(boatluxFile())
    const page = mountWithProviders(DrePage, {
      global: { stubs },
    })
    await flushPromises()
    return page
  }

  const tableLine = (page: Awaited<ReturnType<typeof mountBoatlux>>, label: string) =>
    page
      .getComponent(DreTable)
      .props('report')
      .lines.find((line: { label: string }) => line.label === label)!.values

  it('abre no regime e no banco escolhidos na planilha, com os seletores na faixa do topo', async () => {
    const page = await mountBoatlux()
    const basis = page.getComponent(BasisSelect)
    expect(page.get('section.bg-band').element.contains(basis.element)).toBe(true)
    expect(basis.props('basis')).toEqual({ regime: 'cash', unit: 'Repasse' })
    expect(basis.props('units')).toEqual(['Comercial', 'Repasse'])
    expect(page.get('#dre-completa').text()).toContain('Caixa, Repasse')
  })

  it('recalcula a DRE ao trocar o banco e o regime, mantendo o mês escolhido', async () => {
    const page = await mountBoatlux()
    expect(page.getComponent(PeriodSelect).props('modelValue')).toBe('m:2026-02')

    page.getComponent(BasisSelect).vm.$emit('change', { regime: 'cash', unit: null })
    await flushPromises()
    expect(tableLine(page, 'RECEITA OPERACIONAL BRUTA')).toEqual([100, 80])
    expect(page.get('#dre-completa').text()).toContain('Caixa, todas as unidades')

    page.getComponent(BasisSelect).vm.$emit('change', { regime: 'accrual', unit: null })
    await flushPromises()
    expect(tableLine(page, 'RESULTADO LÍQUIDO (EBITDA)')).toEqual([110, -10])
    expect(page.getComponent(PeriodSelect).props('modelValue')).toBe('m:2026-02')
  })

  it('leva dívidas e estoque para o menu de seções', async () => {
    const page = await mountBoatlux()
    const labels = page.findAll('nav[aria-label="Seções da página"] a').map((link) => link.text())
    expect(labels.at(-1)).toBe('Dívidas e estoque')
  })

  it('mantém regime, conta e período na barra fixa ao rolar', async () => {
    const page = await mountBoatlux()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: -400, bottom: -10 } as DOMRect)
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(page.findAllComponents(BasisSelect)).toHaveLength(2))

    const docked = page.findAllComponents(BasisSelect).find((select) => select.props('compact'))!
    expect(page.findAllComponents(PeriodSelect).filter((select) => select.props('compact'))).toHaveLength(1)
    docked.vm.$emit('change', { regime: 'cash', unit: 'Comercial' })
    await flushPromises()
    expect(page.findAllComponents(BasisSelect).every((select) => select.props('basis').unit === 'Comercial')).toBe(true)
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('mostra as dívidas e o estoque em cards separados', async () => {
    const page = await mountBoatlux()
    const section = page.get('#dividas-estoque')
    const debts = section.getComponent(DebtsCard)
    const stock = section.getComponent(StockCard)
    expect(debts.text()).toContain('Financiamento lancha')
    expect(debts.text()).toContain('atualizada em 01/10/2026')
    expect(debts.text()).toMatch(/Saldo devedor\s*R\$\s?12/)
    expect(stock.text()).toMatch(/Valor em estoque\s*R\$\s?545/)
    expect(stock.text()).toContain('L29')
    expect(stock.text()).toMatch(/2 cotas de R\$\s?145\.000/)
    expect(stock.text()).toContain('Lancha')
  })
})

describe('DrePage: avisos da planilha da Boatlux', () => {
  async function mountBoatlux() {
    await useReport().importFile(boatluxFile())
    const page = mountWithProviders(DrePage, { global: { stubs } })
    await flushPromises()
    return page
  }

  it('numa unidade, não mostra saldo de caixa (o saldo inicial é da empresa toda)', async () => {
    const page = await mountBoatlux()
    expect(page.find('#caixa').exists()).toBe(false)
    expect(page.findAllComponents(StatCard).map((card) => card.props('label'))).not.toContain('Saldo de caixa')
  })

  it('com todas as unidades, aponta o mês em que o saldo inicial não continua o saldo final anterior', async () => {
    const page = await mountBoatlux()
    page.getComponent(BasisSelect).vm.$emit('change', { regime: 'cash', unit: null })
    await flushPromises()
    expect(page.get('#caixa').text()).toMatch(/O saldo inicial de fev\/26 está\s*R\$\s?70,00\s*abaixo do saldo final de jan\/26\./)
  })

  it('na competência, não mostra saldo de caixa e aponta o que fica de fora', async () => {
    const page = await mountBoatlux()
    page.getComponent(BasisSelect).vm.$emit('change', { regime: 'accrual', unit: null })
    page.getComponent(PeriodSelect).vm.$emit('update:modelValue', 'y:2026')
    await flushPromises()

    const labels = page.findAllComponents(StatCard).map((card) => card.props('label'))
    expect(labels).not.toContain('Saldo de caixa')
    expect(page.find('#caixa').exists()).toBe(false)
    // O único lançamento sem data de emissão é de saldo inicial, que não é resultado: nada fica de fora.
    expect(page.findComponent(OutsideEntries).exists()).toBe(false)
  })
})
