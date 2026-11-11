import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfitTargetBase } from '@/application'
import { BOATLUX_LAYOUT, DreReport, RS_NAUTICA_LAYOUT, type LedgerEntry } from '@/domain/dre'
import AppFooter from '@/presentation/components/AppFooter.vue'
import BasisSelect from '@/presentation/components/BasisSelect.vue'
import { Select } from '@/presentation/components/ui/select'
import CellBreakdown from '@/presentation/components/CellBreakdown.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import InfoTip from '@/presentation/components/InfoTip.vue'
import InsightList from '@/presentation/components/InsightList.vue'
import OutsideEntries from '@/presentation/components/OutsideEntries.vue'
import LoaderTrack from '@/presentation/components/LoaderTrack.vue'
import GoalStatement from '@/presentation/components/profit-target/GoalStatement.vue'
import RevenueBar from '@/presentation/components/RevenueBar.vue'
import SectionNav from '@/presentation/components/SectionNav.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import SegmentedControl from '@/presentation/components/SegmentedControl.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import StockCard from '@/presentation/components/StockCard.vue'
import { readStock } from '@/domain/stock'
import ThemeToggle from '@/presentation/components/ThemeToggle.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import VChart from 'vue-echarts'
import { useTheme } from '@/presentation/composables/useTheme'
import { LEDGER_ROWS, STOCK_WITH_SOLD_ROWS, dreRows } from '@/test/fixtures'
import { mountWithProviders } from './mountWithProviders'

describe('InfoTip', () => {
  it('mostra a explicação ao receber foco', async () => {
    const wrapper = mountWithProviders(InfoTip, { props: { text: 'Receita ÷ custo' }, attachTo: document.body })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Como esta informação é calculada')

    await button.trigger('focus')
    await flushPromises()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain('Receita ÷ custo')
  })
})

describe('StatCard', () => {
  it('mostra valor, dica, variação e explicação', () => {
    const wrapper = mountWithProviders(StatCard, {
      props: { label: 'Lucro', value: 'R$ 10', hint: 'Margem 20%', delta: 0.1, deltaLabel: 'set/26', info: 'Como calcula' },
    })
    expect(wrapper.text()).toContain('R$ 10')
    expect(wrapper.text()).toContain('+10%')
    expect(wrapper.text()).toContain('vs set/26')
    expect(wrapper.find('.text-success').exists()).toBe(true)
    expect(wrapper.getComponent(InfoTip).props('text')).toBe('Como calcula')
  })

  it('pinta como ruim a alta de um indicador em que cair é bom', () => {
    const wrapper = mount(StatCard, { props: { label: 'Custo', value: '1', delta: 0.2, lowerIsBetter: true } })
    expect(wrapper.find('.text-destructive').exists()).toBe(true)
  })

  it('omite a variação sem base de comparação', () => {
    const wrapper = mount(StatCard, { props: { label: 'Lucro', value: '1', delta: null } })
    expect(wrapper.text()).not.toContain('%')
  })

  it('pinta de vermelho um valor negativo', () => {
    const wrapper = mount(StatCard, { props: { label: 'EBITDA', value: '-R$ 19 mil', negative: true } })
    expect(wrapper.get('.text-destructive').text()).toBe('-R$ 19 mil')
  })

  it('mostra variação de margem em pontos percentuais', () => {
    const wrapper = mount(StatCard, { props: { label: 'Margem', value: '22%', delta: 0.02, deltaUnit: 'points' } })
    expect(wrapper.text()).toContain('+2,0 p.p.')
  })
})

const REVENUE_OPTIONS = [
  { value: 'all', label: 'Receita bruta' },
  { value: 'l1', label: 'Locação de sala' },
  { value: 'l2', label: 'Vendas vacinas' },
]

describe('ProfitTarget', () => {
  const base: ProfitTargetBase = {
    months: 1,
    revenue: 50_000,
    revenueLabel: null,
    excludedRevenue: 0,
    profit: -2_000,
    contributionRatio: 0.4,
    fixedCosts: 22_000,
    variableLines: [
      { label: 'IMPOSTOS SOBRE VENDA', value: 4_000, kind: 'taxes', ratio: 0.08 },
      { label: 'CUSTOS DAS MERCADORIAS VENDIDAS', value: 21_000, kind: 'purchases', ratio: 0.42 },
      { label: 'OUTRAS DESPESAS VARIÁVEIS', value: 5_000, kind: 'expenses', ratio: 0.1 },
    ],
    excludedLines: [{ label: 'DESPESAS NÃO DESEMBOLSÁVEIS', value: -800 }],
    fixedGroups: [
      { label: 'DESPESAS COM PESSOAL', value: 15_000 },
      { label: 'DESPESAS ADMINISTRATIVAS', value: 7_000 },
    ],
  }
  const mountTarget = (overrides: Partial<ProfitTargetBase> = {}, attachTo?: HTMLElement) =>
    mountWithProviders(ProfitTarget, {
      attachTo,
      props: {
        base: { ...base, ...overrides },
        reference: 'em out/26',
        source: 'DRE Geral, outubro de 2026',
        revenue: 'all',
        revenueOptions: REVENUE_OPTIONS,
      },
    })

  const active = (wrapper: ReturnType<typeof mountTarget>) => wrapper.get('[data-active="true"]')
  const next = (wrapper: ReturnType<typeof mountTarget>) =>
    wrapper.findAll('button').find((b) => b.text().startsWith('Próximo'))!.trigger('click')

  it('começa no resultado, na primeira meta acima do lucro atual', () => {
    const wrapper = mountTarget()
    expect(wrapper.get('[aria-pressed="true"], [data-state="on"]').text()).toMatch(/R\$\s?10\smil/)
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Resultado')
    expect(wrapper.findAll('section')).toHaveLength(5)
    expect(wrapper.findAll('section[inert]')).toHaveLength(4)
    expect(active(wrapper).text()).toMatch(/precisa chegar a\s*R\$\s?80\smil/)
    expect(active(wrapper).text()).toMatch(/Faturar a mais\s*R\$\s?30\smil\s*\+60% sobre a receita em out\/26/)
    expect(active(wrapper).text()).toMatch(/Comprar a mais para vender\s*R\$\s?12,6\smil/)
    expect(wrapper.text()).toContain('1 de 5')
  })

  it('compara hoje com a meta, linha a linha, com valores e diferença', async () => {
    const wrapper = mountTarget()
    await next(wrapper)
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Hoje × meta')
    const rows = active(wrapper).findAll('ul.divide-y > li').map((li) => li.text())
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatch(/Receita bruta.*Hoje: R\$\s?50\.000.*Na meta: R\$\s?80\.000.*\+R\$\s?30\.000/)
    expect(rows[1]).toMatch(/Compras para vender.*Hoje: R\$\s?21\.000.*Na meta: R\$\s?33\.600.*\+R\$\s?12\.600/)
    expect(rows[2]).toMatch(/Outros custos variáveis.*Hoje: R\$\s?9\.000.*Na meta: R\$\s?14\.400/)
    expect(rows[3]).toMatch(/Despesas operacionais.*Hoje: R\$\s?22\.000.*Na meta: R\$\s?22\.000.*igual/)
    expect(rows[4]).toMatch(/Resultado operacional.*Hoje: -R\$\s?2\.000.*Na meta: R\$\s?10\.000.*\+R\$\s?12\.000/)
    expect(active(wrapper).text()).toMatch(/Margem de lucro em out\/26\s*-4%.*Margem de lucro na meta\s*12,5%/)
  })

  it('mostra a conta passo a passo com os números do período e a prova', async () => {
    const wrapper = mountTarget()
    await next(wrapper)
    await next(wrapper)
    const slide = active(wrapper).text()
    expect(slide).toContain('Como calculamos')
    expect(slide).toMatch(/R\$\s?20\.000 ÷ R\$\s?50\.000\s*= 40%/)
    expect(slide).toMatch(/Linha da DRE em out\/26\s*= R\$\s?22\.000\s*Despesas operacionais/)
    expect(slide).toMatch(/\(R\$\s?22\.000 \+ R\$\s?10\.000\) ÷\s*40%\s*= R\$\s?80\.000/)
    expect(slide).toMatch(/R\$\s?80\.000 de receita − R\$\s?48\.000 de\s*custos variáveis \(60% da receita\) −\s*R\$\s?22\.000 de despesas fixas =\s*R\$\s?10\.000 de lucro/)
  })

  it('no acumulado, mostra as despesas operacionais como média dos meses', async () => {
    const wrapper = mountTarget({ months: 3 })
    await next(wrapper)
    await next(wrapper)
    expect(active(wrapper).text()).toMatch(/R\$\s?66\.000 ÷ 3 meses\s*= R\$\s?22\.000\s*Despesas operacionais, média mensal/)
  })

  it('mostra junto da conta de onde vêm os números e o que fica de fora', async () => {
    const wrapper = mountTarget()
    await next(wrapper)
    await next(wrapper)
    expect(active(wrapper).text()).toContain('Base: DRE Geral, outubro de 2026.')
    expect(active(wrapper).text()).toMatch(/hoje -R\$\s?2\.000 por mês\.\s*Fora da conta: Despesas não desembolsáveis \(-R\$\s?800\)/)
  })

  it('sugere caminhos que fecham a meta, cada um com seu número', async () => {
    const wrapper = mountTarget()
    for (let i = 0; i < 4; i++) await next(wrapper)
    const cards = active(wrapper).findAll('ul.grid > li').map((li) => li.text())
    expect(active(wrapper).text()).toMatch(/Faltam R\$\s?12\.000 de\s*resultado por mês/)
    expect(cards[0]).toMatch(/Vender mais\s*\+R\$\s?30\smil\s*de vendas por mês\s*\(\+60%\)/)
    expect(cards[1]).toMatch(/Reajustar preços\s*\+29,3%/)
    expect(cards[2]).toMatch(/Negociar compras\s*−57,1%.*R\$\s?12\smil a menos por mês/)
    expect(cards[3]).toMatch(/Cortar despesas operacionais\s*−R\$\s?12\smil.*54,5% das despesas operacionais.*Despesas com pessoal \(R\$\s?15\smil\)/)
    expect(cards[4]).toMatch(/Plano combinado.*\+R\$\s?10\smil\s*em vendas por mês\s*\+9,8%\s*nos preços\s*−R\$\s?4\smil\s*em despesas/)
  })

  it('deixa escolher a receita considerada e explica o que ficou de fora', async () => {
    const wrapper = mountTarget({ revenueLabel: 'Vendas vacinas', excludedRevenue: 8_000 })
    expect(wrapper.get('#meta-receita').text()).toBe('Receita considerada')
    expect(active(wrapper).text()).toContain('Vendas vacinas em out/26')
    await next(wrapper)
    await next(wrapper)
    expect(active(wrapper).text()).toMatch(/Receita considerada: só Vendas vacinas\. As outras receitas \(R\$\s?8\.000\s*por mês\) ficam fora/)
  })

  it('esconde caminhos que não se aplicam e mostra os grupos de despesa só quando existem', async () => {
    const wrapper = mountTarget({
      variableLines: [{ label: 'IMPOSTOS SOBRE VENDA', value: 30_000, kind: 'taxes', ratio: 0.6 }],
      fixedGroups: [],
    })
    for (let i = 0; i < 4; i++) await next(wrapper)
    const text = active(wrapper).text()
    expect(text).toContain('Reajustar preços')
    expect(text).not.toContain('Negociar compras')
    expect(text).not.toContain('Maiores grupos')
  })

  it('abre como modal mantendo o slide e fecha pelo Esc, pelo X ou pelo fundo', async () => {
    const host = document.body.appendChild(document.createElement('div'))
    const wrapper = mountTarget({}, host)
    const dialog = () => document.body.querySelector('[role="dialog"]')
    const open = async () => {
      await wrapper.get('button[aria-label="Abrir em tela cheia"]').trigger('click')
      await flushPromises()
    }
    const afterClosing = () => new Promise((resolve) => setTimeout(resolve, 300))

    await next(wrapper)
    await open()
    expect(dialog()!.getAttribute('aria-modal')).toBe('true')
    expect(dialog()!.querySelector('h2')!.textContent).toBe('Meta de lucro')
    expect(dialog()!.querySelector('[aria-current="step"]')!.textContent).toContain('Hoje × meta')
    expect(dialog()!.querySelector('.animate-modal-in')).not.toBeNull()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fechar')

    const listbox = document.createElement('div')
    listbox.setAttribute('role', 'listbox')
    document.body.appendChild(listbox)
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(dialog()!.querySelector('.animate-modal-out')).toBeNull()
    listbox.remove()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(dialog()!.querySelector('.animate-modal-out')).not.toBeNull()
    await afterClosing()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Hoje × meta')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Abrir em tela cheia')

    await open()
    ;(document.body.querySelector('button[aria-label="Fechar"]') as HTMLButtonElement).click()
    await afterClosing()
    await flushPromises()
    expect(dialog()).toBeNull()

    await open()
    ;(dialog()!.querySelector('.animate-backdrop-in') as HTMLElement).click()
    await afterClosing()
    await flushPromises()
    expect(dialog()).toBeNull()
    host.remove()
  })

  it('reconhece a meta já batida em vez de sugerir caminhos', async () => {
    const wrapper = mountTarget({ profit: 120_000 })
    for (let i = 0; i < 4; i++) await next(wrapper)
    expect(active(wrapper).text()).toMatch(/A meta já é batida.*A folga é de\s*R\$\s?20\.000 por mês/)
  })

  it('segue para a tabela linha a linha e para as premissas, e volta ao início', async () => {
    const wrapper = mountTarget()
    await next(wrapper)
    await next(wrapper)
    await next(wrapper)
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Linha a linha')
    const purchases = active(wrapper).findAll('tbody tr').find((tr) => tr.text().includes('Custos das mercadorias vendidas'))!
    expect(purchases.text()).toContain('compras')
    expect(purchases.text()).toMatch(/42%.*-R\$\s?33\.600.*-R\$\s?12\.600/)
    expect(active(wrapper).findAll('tbody tr').at(-1)!.text()).toMatch(/Resultado operacional.*R\$\s?10\.000/)

    await next(wrapper)
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Caminhos e sugestões')
    expect(wrapper.text()).toContain('5 de 5')

    await wrapper.findAll('button').find((b) => b.text() === 'Voltar ao início')!.trigger('click')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Resultado')
  })

  it('troca de passo pelas setas do teclado', async () => {
    const wrapper = mountTarget()
    await active(wrapper).trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Hoje × meta')
    await active(wrapper).trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[aria-current="step"]').text()).toContain('Resultado')
  })

  it('recalcula ao escolher outra meta', async () => {
    const wrapper = mountTarget()
    const option = wrapper.findAll('button').find((b) => /R\$\s?50\smil/.test(b.text()))!
    await option.trigger('click')
    expect(active(wrapper).text()).toMatch(/precisa chegar a\s*R\$\s?180\smil/)
  })

  it('avisa quando a meta já foi atingida', () => {
    const wrapper = mountTarget({ profit: 120_000 })
    expect(wrapper.text()).toMatch(/Meta atingida: o resultado operacional em out\/26 foi de R\$\s?120\smil/)
    expect(wrapper.text()).not.toContain('Outros caminhos')
  })

  it('explica por que vender mais não resolve com margem negativa', () => {
    const wrapper = mountTarget({ contributionRatio: -0.05 })
    expect(wrapper.text()).toContain('Vender mais não leva a essa meta')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Opção A' },
    { value: 'b', label: 'Opção B' },
  ] as const

  it('marca a opção ativa e emite a escolha', async () => {
    const wrapper = mount(SegmentedControl, { props: { options, label: 'Teste', modelValue: 'a' } })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false'])
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })
})

describe('InsightList', () => {
  it('mostra cada ponto com o tom em texto e a explicação', () => {
    const wrapper = mountWithProviders(InsightList, {
      props: {
        insights: [{ title: 'Lucro em alta', description: 'Subiu 10%', tone: 'positive', explanation: 'Lucro ÷ lucro anterior' }],
      },
    })
    expect(wrapper.text()).toContain('Lucro em alta')
    expect(wrapper.text()).toContain('Ponto positivo')
    expect(wrapper.getComponent(InfoTip).props('text')).toBe('Lucro ÷ lucro anterior')
  })
})

describe('DreTable', () => {
  const report = DreReport.fromTable({ sheet: 'DRE Unidades', rows: dreRows() })!
  const mountTable = () => mountWithProviders(DreTable, { props: { report, highlight: [2] } })
  const rowLabels = (wrapper: ReturnType<typeof mountTable>) => wrapper.findAll('tbody th').map((th) => th.text())

  it('com poucos meses, centraliza a tabela no card em vez de colar as colunas à direita', () => {
    const table = mountTable().get('table')
    expect(table.classes()).toEqual(expect.arrayContaining(['mx-auto', 'w-auto']))
    expect(table.classes()).not.toContain('min-w-full')
  })

  it('começa com seções abertas, grupos fechados e sem contas zeradas', () => {
    const labels = rowLabels(mountTable())
    expect(labels).toContain('Despesas com pessoal')
    expect(labels).not.toContain('Salários')
    expect(labels).not.toContain('Outras despesas variáveis')
  })

  it('abre um grupo ao clicar', async () => {
    const wrapper = mountTable()
    const group = wrapper.findAll('tbody button').find((b) => b.text() === 'Despesas com pessoal')!
    await group.trigger('click')
    expect(group.attributes('aria-expanded')).toBe('true')
    expect(rowLabels(wrapper)).toContain('Salários')
  })

  it('mostra contas zeradas sob demanda', async () => {
    const wrapper = mountTable()
    await wrapper.get('[role="checkbox"]').trigger('click')
    expect(rowLabels(wrapper)).toContain('Outras despesas variáveis')
  })

  it('alterna entre valores e análise vertical', async () => {
    const wrapper = mountTable()
    const revenueRow = () => wrapper.findAll('tbody tr')[0]!.findAll('td').map((td) => td.text())
    expect(revenueRow()).toEqual(['1.000', '1.200', '900'])
    await wrapper.findAll('button[aria-pressed]')[1]!.trigger('click')
    expect(revenueRow()).toEqual(['100%', '100%', '100%'])
    expect(wrapper.findAll('tbody tr')[0]!.findAll('td [data-alt]').map((el) => el.attributes('data-alt'))).toEqual([
      '1.000',
      '1.200',
      '900',
    ])
  })

  it('mostra todos os meses por padrão e esconde os que forem desmarcados no filtro', async () => {
    const wrapper = mountTable()
    const headers = () => wrapper.findAll('thead th[data-period]').map((th) => th.text())
    const revenueRow = () => wrapper.findAll('tbody tr')[0]!.findAll('td').map((td) => td.text())
    expect(headers()).toEqual(['jan/26', 'fev/26', 'mar/26'])
    expect(wrapper.text()).toContain('Meses: todos')

    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    await flushPromises()
    const option = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent!.trim() === label)!
    option('jan/26').click()
    await flushPromises()
    expect(headers()).toEqual(['fev/26', 'mar/26'])
    expect(revenueRow()).toEqual(['1.200', '900'])
    expect(wrapper.text()).toContain('Meses: 2 de 3')

    option('fev/26').click()
    await flushPromises()
    expect(option('mar/26').disabled).toBe(true)

    option('Todos').click()
    await flushPromises()
    expect(headers()).toEqual(['jan/26', 'fev/26', 'mar/26'])
  })

  it('pinta resultado, seção e grupo em faixas como na planilha, sem cor nos negativos', async () => {
    const wrapper = mountTable()
    await wrapper.findAll('tbody button').find((b) => b.text() === 'Despesas com pessoal')!.trigger('click')
    const row = (label: string) => wrapper.findAll('tbody tr').find((tr) => tr.get('th').text() === label)!
    const tone = (label: string) => ['bg-result', 'bg-section', 'bg-group'].find((bg) => row(label).classes(bg)) ?? 'conta'
    expect(tone('Resultado líquido (EBITDA)')).toBe('bg-result')
    expect(tone('Despesas com pessoal')).toBe('bg-group')
    expect(tone('Salários')).toBe('conta')
    expect(row('Resultado líquido (EBITDA)').classes()).toContain('uppercase')
    expect(row('Resultado líquido (EBITDA)').get('th').classes()).toContain('bg-result')
    expect(wrapper.find('td.text-destructive').exists()).toBe(false)
  })

  it('em tela cheia, mostra os filtros do slot e o regime no subtítulo', async () => {
    const host = document.body.appendChild(document.createElement('div'))
    const wrapper = mountWithProviders(DreTable, {
      props: { report, highlight: [2], basis: 'Caixa, Comercial' },
      slots: { filters: () => h('p', { 'data-filters': '' }, 'Unidade') },
      attachTo: host,
    })
    expect(wrapper.find('[data-filters]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Abrir em tela cheia"]').trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.querySelector('[data-filters]')).not.toBeNull()
    expect(dialog.textContent).toContain('Caixa, Comercial')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.vm.$.appContext.app.unmount()
    host.remove()
  })

  it('marca a coluna do período selecionado, sem destaque visual, para rolar até ela', () => {
    expect(mountTable().get('[data-highlight]').text()).toBe('mar/26')
  })

  it('sem aba de lançamentos, os valores não são clicáveis', () => {
    expect(mountTable().find('tbody td button').exists()).toBe(false)
  })

  it('abre os lançamentos que compõem um valor ao clicar', async () => {
    const withLedger = DreReport.fromWorkbook([
      { sheet: 'DRE Unidades', rows: dreRows() },
      { sheet: 'Fluxo de Caixa', rows: LEDGER_ROWS },
    ], { name: 'DRE' })
    const wrapper = mountWithProviders(DreTable, { props: { report: withLedger, highlight: [2] } })
    const group = wrapper.findAll('tbody button').find((b) => b.text() === 'Despesas com pessoal')!
    await group.trigger('click')

    await wrapper.get('button[aria-label$="ver lançamentos de Salários em mar/26"]').trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.querySelector('h2')!.textContent).toBe('Salários')
    expect(dialog.textContent).toContain('março de 2026, lançamentos pela data de pagamento')
    expect(dialog.textContent).toContain('Confere')
    expect(dialog.textContent).toMatch(/Soma de 2 lançamentos/)
    expect([...dialog.querySelectorAll('tbody tr')].map((tr) => tr.textContent)).toEqual([
      expect.stringMatching(/05\/03\/2026.*Folha de março, parte 1.*Matriz.*-R\$\s?200,00/),
      expect.stringMatching(/20\/03\/2026.*Folha de março, parte 2.*Matriz.*-R\$\s?150,00/),
    ])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('abre em tela cheia e, dali, o detalhe de um valor fecha sem fechar a tabela', async () => {
    const withLedger = DreReport.fromWorkbook([
      { sheet: 'DRE Unidades', rows: dreRows() },
      { sheet: 'Fluxo de Caixa', rows: LEDGER_ROWS },
    ], { name: 'DRE' })
    const host = document.body.appendChild(document.createElement('div'))
    const wrapper = mountWithProviders(DreTable, { props: { report: withLedger, highlight: [2] }, attachTo: host })
    const dialogs = () => [...document.body.querySelectorAll('[role="dialog"]')]
    const afterClosing = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await flushPromises()
    }

    await wrapper.get('button[aria-label="Abrir em tela cheia"]').trigger('click')
    await flushPromises()
    expect(dialogs().map((d) => d.querySelector('h2')!.textContent)).toEqual(['DRE completa'])
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fechar')

    const buttons = () => [...dialogs()[0]!.querySelectorAll('button')]
    buttons().find((b) => b.textContent!.trim() === 'Despesas com pessoal')!.click()
    await flushPromises()
    buttons().find((b) => b.getAttribute('aria-label')?.endsWith('ver lançamentos de Salários em mar/26'))!.click()
    await flushPromises()
    expect(dialogs()).toHaveLength(2)
    const layer = (dialog: Element) => (dialog as HTMLElement).style.zIndex
    const titled = (title: string) => dialogs().find((d) => d.querySelector('h2')!.textContent === title)!
    expect(layer(titled('DRE completa'))).toBe('calc(var(--layer-modal) + 0)')
    expect(layer(titled('Salários'))).toBe('calc(var(--layer-modal) + 1)')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await afterClosing()
    expect(dialogs().map((d) => d.querySelector('h2')!.textContent)).toEqual(['DRE completa'])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await afterClosing()
    expect(dialogs()).toEqual([])
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Abrir em tela cheia')
    wrapper.vm.$.appContext.app.unmount()
    host.remove()
  })
})

describe('CellBreakdown', () => {
  const entry = (fields: Partial<LedgerEntry>): LedgerEntry => ({
    date: '',
    issueDate: '',
    description: '',
    category: '',
    account: '',
    unit: '',
    bank: '',
    value: 0,
    cashPeriod: { year: 2026, month: 3 },
    accrualPeriod: null,
    ...fields,
  })
  const breakdown = {
    label: 'DESPESAS OPERACIONAIS',
    period: { year: 2026, month: 3 },
    basis: { regime: 'cash' as const, unit: null },
    segment: BOATLUX_LAYOUT.segment,
    value: -700,
    total: -600,
    difference: -100,
    entries: [
      entry({ date: '2026-03-05', description: 'Folha', category: 'Salários', unit: 'Matriz', value: -350 }),
      entry({ date: '2026-03-10', issueDate: '2026-02-25', category: 'Aluguel', value: -250 }),
    ],
    accounts: [
      { label: 'Salários', total: -350, count: 1 },
      { label: 'Aluguel', total: -250, count: 1 },
    ],
  }

  it('aponta a diferença e mostra o peso de cada conta', () => {
    const wrapper = mount(CellBreakdown, { props: { breakdown } })
    expect(wrapper.text()).toContain('Não confere')
    expect(wrapper.text()).toMatch(/Diferença de -R\$\s?100,00/)
    expect(wrapper.text()).toMatch(/Salários\s*-R\$\s?350,00\s*\(58,3%\)/)
    expect(wrapper.findAll('thead th').map((th) => th.text())).toContain('Conta')
    expect(wrapper.findAll('tbody tr')[1]!.text()).toMatch(/10\/03\/2026\s*–\s*Aluguel\s*–/)
  })

  it('ordena os lançamentos ao clicar no cabeçalho', async () => {
    const wrapper = mount(CellBreakdown, { props: { breakdown } })
    const header = () => wrapper.findAll('thead th').find((th) => th.text() === 'Valor')!
    const values = () => wrapper.findAll('tbody tr').map((tr) => tr.findAll('td').at(-1)!.text())

    await header().get('button').trigger('click')
    expect(header().attributes('aria-sort')).toBe('descending')
    expect(values().map((v) => v.replace(/\s/g, ''))).toEqual(['-R$250,00', '-R$350,00'])

    await wrapper.findAll('thead th').find((th) => th.text() === 'Conta')!.get('button').trigger('click')
    expect(wrapper.findAll('tbody tr')[0]!.text()).toContain('Aluguel')
    expect(header().attributes('aria-sort')).toBe('none')
  })

  it('na competência, mostra a data de emissão e o banco de cada lançamento', () => {
    const accrual = {
      ...breakdown,
      basis: { regime: 'accrual' as const, unit: null },
      entries: breakdown.entries.map((item, i) => ({ ...item, bank: i ? 'Sicredi' : '' })),
    }
    const wrapper = mount(CellBreakdown, { props: { breakdown: accrual } })
    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toContain('Emissão')
    expect(headers).toContain('Banco')
    expect(wrapper.findAll('tbody tr')[1]!.text()).toMatch(/25\/02\/2026.*Sicredi/)
    expect(wrapper.findAll('tbody tr')[0]!.text()).toMatch(/^–/)
  })

  it('avisa quando não há lançamentos pagos no mês', () => {
    const wrapper = mount(CellBreakdown, { props: { breakdown: { ...breakdown, entries: [], accounts: [], total: 0 } } })
    expect(wrapper.text()).toContain('Nenhum lançamento desta conta foi pago neste mês')
  })
})

describe('BasisSelect', () => {
  const mountWith = (basis: { regime: 'cash' | 'accrual'; unit: string | null }) =>
    mount(BasisSelect, { props: { basis, units: ['Comercial', 'GC', 'Repasse'] } })

  it('troca a unidade e volta para todas as unidades, mantendo o regime', () => {
    const wrapper = mountWith({ regime: 'accrual', unit: null })
    const [, unit] = wrapper.findAllComponents(Select)
    expect(unit!.props('modelValue')).toBe('*')
    expect(unit!.props('disabled')).toBeFalsy()
    unit!.vm.$emit('update:modelValue', 'GC')
    unit!.vm.$emit('update:modelValue', '*')
    expect(wrapper.emitted('change')).toEqual([[{ regime: 'accrual', unit: 'GC' }], [{ regime: 'accrual', unit: null }]])
  })

  it('troca o regime mantendo a unidade, como na planilha', () => {
    const wrapper = mountWith({ regime: 'cash', unit: 'Repasse' })
    wrapper.findAllComponents(Select)[0]!.vm.$emit('update:modelValue', 'accrual')
    expect(wrapper.emitted('change')).toEqual([[{ regime: 'accrual', unit: 'Repasse' }]])
  })

  it('esconde a unidade quando o fluxo de caixa não informa unidades', () => {
    const wrapper = mount(BasisSelect, { props: { basis: { regime: 'cash', unit: null }, units: [] } })
    expect(wrapper.findAllComponents(Select)).toHaveLength(1)
  })
})

describe('AppFooter', () => {
  it('assina o projeto com link para o LinkedIn em nova aba', () => {
    const link = mount(AppFooter).get('a')
    expect(link.text()).toContain('Alessandro Hugen')
    expect(link.attributes('href')).toBe('https://www.linkedin.com/in/alehugen')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })
})

describe('ThemeToggle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('troca o tema pelos ícones, com rótulo acessível em cada um', async () => {
    const wrapper = mountWithProviders(ThemeToggle)
    const items = wrapper.findAll('button')
    expect(items.map((item) => item.attributes('aria-label'))).toEqual(['Tema claro', 'Tema escuro', 'Seguir o sistema'])

    expect(useTheme().preference.value).toBe('light')
    await items[1]!.trigger('click')
    expect(useTheme().preference.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await items[0]!.trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('RevenueBar', () => {
  const slices = [
    { key: 'taxes' as const, value: 90, share: 0.09, parts: [{ label: 'IMPOSTOS SOBRE VENDA', value: 90 }] },
    { key: 'costOfSales' as const, value: 310, share: 0.31, parts: [{ label: 'CUSTOS DAS MERCADORIAS VENDIDAS', value: 310 }] },
    { key: 'variableExpenses' as const, value: 10, share: 0.01, parts: [{ label: 'OUTRAS DESPESAS VARIÁVEIS', value: 10 }] },
    { key: 'fixedExpenses' as const, value: 470, share: 0.47, parts: [{ label: 'DESPESAS OPERACIONAIS', value: 470 }] },
  ]

  it('mostra quanto cada etapa consome de cada R$ 100 e quanto sobra', () => {
    const wrapper = mountWithProviders(RevenueBar, {
      props: { flow: { revenue: 1000, slices, result: 120, resultShare: 0.12 } },
    })
    const text = wrapper.text().replace(/\s/g, ' ')
    expect(wrapper.get('figcaption').text()).toBe('De cada R$ 100 vendidos')
    expect(text).toContain('R$ 31 custos das vendas')
    expect(text).toContain('R$ 12 sobram')
    expect(wrapper.find('[style*="left"]').exists()).toBe(false)
  })

  it('esconde da vista o rótulo das fatias estreitas, mas mantém para leitores de tela', () => {
    const wrapper = mountWithProviders(RevenueBar, {
      props: { flow: { revenue: 1000, slices, result: 120, resultShare: 0.12 } },
    })
    const variable = wrapper.findAll('li')[2]!
    expect(variable.text()).toContain('despesas variáveis')
    expect(variable.findAll('.sr-only')).toHaveLength(2)
  })

  it('no prejuízo, diz quanto a operação gastou e marca o que passou da receita', () => {
    const loss = [...slices.slice(0, 3), { key: 'fixedExpenses' as const, value: 670, share: 0.67, parts: [] }]
    const wrapper = mountWithProviders(RevenueBar, {
      props: { flow: { revenue: 1000, slices: loss, result: -80, resultShare: -0.08 } },
    })
    expect(wrapper.get('figcaption').text().replace(/\s/g, ' ')).toBe('De cada R$ 100 vendidos, a operação gastou R$ 108')
    expect(wrapper.text().replace(/\s/g, ' ')).toContain('R$ 8 faltam')
    expect(wrapper.get('[style*="left"]').text()).toBe('receita')
  })

  it('arredonda as partes para fecharem exatamente R$ 100', () => {
    const thirds = [
      { key: 'taxes' as const, value: 333, share: 0.333, parts: [] },
      { key: 'costOfSales' as const, value: 333, share: 0.333, parts: [] },
    ]
    const wrapper = mountWithProviders(RevenueBar, {
      props: { flow: { revenue: 1000, slices: thirds, result: 334, resultShare: 0.334 } },
    })
    const values = wrapper.findAll('li .figure').map((el) => Number(el.text().replace(/\D/g, '')))
    expect(values.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('cada parte da barra mostra a conta e as linhas da DRE que a compõem', async () => {
    const host = document.body.appendChild(document.createElement('div'))
    const wrapper = mountWithProviders(RevenueBar, {
      props: { flow: { revenue: 1000, slices, result: 120, resultShare: 0.12 } },
      attachTo: host,
    })
    const part = wrapper.get('[aria-label^="custos das vendas"]')
    expect(part.attributes('aria-label')).toMatch(/^custos das vendas: R\$\s31 de cada R\$ 100\. Ver de onde vem o valor$/)
    await part.trigger('focus')
    await vi.waitFor(() => expect(document.body.querySelector('[data-slot="tooltip-content"]')).not.toBeNull())
    const tip = document.body.querySelector('[data-slot="tooltip-content"]')!.textContent!.replace(/\s+/g, ' ')
    expect(tip).toContain('Lucro operacional bruto')
    expect(tip).toContain('Custos das mercadorias vendidas')
    expect(tip).toMatch(/-R\$ 310/)
    expect(tip).toMatch(/receita bruta de R\$ 1\.000/)
    wrapper.vm.$.appContext.app.unmount()
    host.remove()
  })
})


describe('GoalStatement', () => {
  it('mostra a conta da meta e o lucro em destaque, com a margem', () => {
    const wrapper = mountWithProviders(GoalStatement, {
      props: { revenue: 400_000, variableCosts: 200_000, fixedCosts: 150_000, profit: 50_000 },
    })
    const clean = (text: string) => text.replace(/\s+/g, ' ')
    const pairs = wrapper.findAll('dl > div').map((row) => row.findAll('dt, dd').map((cell) => clean(cell.text())))
    expect(pairs).toEqual([
      ['Receita necessária', 'R$ 400 mil'],
      ['Custos variáveis', '−R$ 200 mil'],
      ['Despesas fixas', '−R$ 150 mil'],
      ['Lucro por mês', 'R$ 50 milNo azul', '12,5% da receita'],
    ])
  })
})

describe('LoaderTrack', () => {
  it('anuncia o carregamento só quando ativo', async () => {
    const wrapper = mount(LoaderTrack, { props: { active: true, label: 'Carregando a página' } })
    expect(wrapper.attributes('role')).toBe('progressbar')
    expect(wrapper.attributes('aria-label')).toBe('Carregando a página')
    await wrapper.setProps({ active: false })
    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.classes()).toContain('opacity-0')
  })
})

describe('OutsideEntries', () => {
  const groups = [
    { reason: 'no-category' as const, label: 'Transferência de Saída', count: 46, total: -773296 },
    { reason: 'no-category' as const, label: 'Transferência de Entrada', count: 46, total: 694376 },
    { reason: 'unknown-category' as const, label: 'Servicos', count: 1, total: 5 },
  ]

  it('resume quantos lançamentos ficam de fora e explica cada motivo', () => {
    const wrapper = mount(OutsideEntries, { props: { groups, when: 'em fev/26' } })
    expect(wrapper.get('summary').text().replace(/\s/g, ' ')).toContain('93 lançamentos (-R$ 78,9 mil) em fev/26 não entram na DRE.')
    const sections = wrapper.findAll('section')
    expect(sections.map((section) => section.get('h3').text())).toEqual(['Sem categoria', 'Categoria fora da DRE'])
    expect(sections[0]!.text()).toContain('aba Lista')
    expect(sections[0]!.findAll('li')[0]!.text()).toMatch(/Transferência de Saída\s*46 lançamentos, -R\$\s?773\.296,00/)
  })

  it('não aparece quando tudo entra na DRE', () => {
    expect(mount(OutsideEntries, { props: { groups: [], when: 'em fev/26' } }).html()).toBe('<!--v-if-->')
  })
})

describe('SectionNav', () => {
  const sections = [
    { id: 'indicadores', label: 'Indicadores' },
    { id: 'dre-completa', label: 'DRE completa' },
  ]

  function mountNav() {
    const host = document.createElement('div')
    host.innerHTML = '<section id="indicadores"></section><section id="dre-completa"></section>'
    document.body.append(host)
    const wrapper = mount(SectionNav, { props: { sections }, attachTo: document.body })
    const place = (id: string, top: number) =>
      vi.spyOn(document.getElementById(id)!, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
    return { wrapper, host, place }
  }

  it('destaca a seção que chegou ao topo ao rolar', async () => {
    const { wrapper, host, place } = mountNav()
    const current = () => wrapper.find('[aria-current="location"]').text()
    place('indicadores', 0)
    place('dre-completa', 900)
    window.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(current()).toBe('Indicadores'))

    place('indicadores', -800)
    place('dre-completa', 0)
    window.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(current()).toBe('DRE completa'))
    wrapper.unmount()
    host.remove()
  })

  it('leva até a seção ao clicar e já a marca como atual', async () => {
    const { wrapper, host } = mountNav()
    const scrollIntoView = vi.fn()
    document.getElementById('dre-completa')!.scrollIntoView = scrollIntoView
    await wrapper.findAll('a')[1]!.trigger('click')
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBe('location')
    wrapper.unmount()
    host.remove()
  })
})

describe('TrendChart', () => {
  const series = [
    { name: 'Receita', type: 'bar' as const, data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { name: 'Custos', type: 'bar' as const, data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  ]
  const categories = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out']
  const mountChart = () =>
    mountWithProviders(TrendChart, { props: { categories, series, highlightIndex: 4 }, global: { stubs: { echarts: true } } })
  const option = (wrapper: ReturnType<typeof mountChart>) => wrapper.findComponent(VChart).props('option') as {
    legend: { selected: Record<string, boolean> }
    xAxis: { axisLabel: { interval: (index: number) => boolean } }
  }

  it('mostra a legenda fora do gráfico e esconde ou mostra a série ao clicar, sem esconder todas', async () => {
    const wrapper = mountChart()
    const buttons = () => wrapper.findAll('[aria-label="Séries do gráfico"] button')
    expect(buttons().map((b) => b.text())).toEqual(['Receita', 'Custos'])

    await buttons()[0]!.trigger('click')
    expect(option(wrapper).legend.selected).toEqual({ Receita: false, Custos: true })
    expect(buttons()[0]!.attributes('aria-pressed')).toBe('false')

    await buttons()[1]!.trigger('click')
    expect(option(wrapper).legend.selected).toEqual({ Receita: false, Custos: true })

    await buttons()[0]!.trigger('click')
    expect(option(wrapper).legend.selected).toEqual({ Receita: true, Custos: true })
  })

  it('sem largura medida, mostra poucos meses, mas sempre o selecionado', () => {
    const interval = option(mountChart()).xAxis.axisLabel.interval
    const shown = categories.map((_, i) => i).filter((i) => interval(i))
    expect(shown).toContain(4)
    expect(shown.length).toBeLessThan(categories.length)
  })
})

describe('CellBreakdown com banco escolhido (RS Náutica)', () => {
  it('não repete a coluna Banco nem mostra a coluna Unidade vazia', () => {
    const entry = {
      date: '2026-02-10', issueDate: '', description: 'Turma', category: 'Escola Náutica', account: '',
      unit: '', bank: '02 - SICREDI', value: 40, cashPeriod: { year: 2026, month: 2 }, accrualPeriod: null,
    }
    const breakdown = {
      label: 'Escola Náutica', period: { year: 2026, month: 2 }, basis: { regime: 'cash' as const, unit: '02 - SICREDI' },
      segment: RS_NAUTICA_LAYOUT.segment, value: 40, total: 40, difference: 0, entries: [entry],
      accounts: [{ label: 'Escola Náutica', total: 40, count: 1 }],
    }
    const headers = mount(CellBreakdown, { props: { breakdown } }).findAll('thead th').map((th) => th.text())
    expect(headers).not.toContain('Banco')
    expect(headers).not.toContain('Unidade')
  })
})

describe('CellBreakdown com unidade escolhida', () => {
  it('não repete a coluna Unidade, que só diria o filtro', () => {
    const breakdown = {
      label: 'Vendas',
      period: { year: 2026, month: 2 },
      basis: { regime: 'cash' as const, unit: 'Repasse' },
      segment: BOATLUX_LAYOUT.segment,
      value: 10,
      total: 10,
      difference: 0,
      entries: [
        {
          date: '2026-02-02',
          issueDate: '',
          description: 'Venda',
          category: 'Vendas',
          account: '',
          unit: 'Repasse',
          bank: '',
          value: 10,
          cashPeriod: { year: 2026, month: 2 },
          accrualPeriod: null,
        },
      ],
      accounts: [{ label: 'Vendas', total: 10, count: 1 }],
    }
    const headers = mount(CellBreakdown, { props: { breakdown } }).findAll('thead th').map((th) => th.text())
    expect(headers).not.toContain('Unidade')
    expect(headers).not.toContain('Banco')
  })
})

describe('StockCard', () => {
  const stock = readStock({ sheet: 'Estoque', rows: STOCK_WITH_SOLD_ROWS })!

  it('mostra as cotas vendidas no mesmo formato, com a movimentação abaixo da barra', () => {
    const card = mountWithProviders(StockCard, { props: { stock } })
    const sold = card.get('[data-sold]')
    expect(card.text()).toMatch(/Cotas vendidas\s*R\$\s?465\.000\s*em 5 cotas/)
    const groups = sold.findAll(':scope > li').map((li) => li.text())
    expect(groups[0]).toMatch(/^L31\s*Lancha\s*R\$\s?453\.000/)
    expect(groups[0]).toContain('Grupo L20 fez upgrade para a L31 (cotas 01 e 04).')
    expect(groups.find((text) => text.startsWith('L13'))).toContain(
      'Troca de embarcação com a L20: não foi venda e fica fora do total vendido.',
    )
    expect(groups.find((text) => text.startsWith('L13'))).toContain('1 cota em troca')
  })

  it('sem lista de vendidas, não mostra o bloco', () => {
    const card = mountWithProviders(StockCard, { props: { stock: { ...stock, sold: null } } })
    expect(card.find('[data-sold]').exists()).toBe(false)
  })
})
