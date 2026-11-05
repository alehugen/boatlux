import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfitTargetBase } from '@/application'
import { DreReport } from '@/domain/dre'
import AppFooter from '@/presentation/components/AppFooter.vue'
import CellBreakdown from '@/presentation/components/CellBreakdown.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import InfoTip from '@/presentation/components/InfoTip.vue'
import InsightList from '@/presentation/components/InsightList.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import ReportCard from '@/presentation/components/ReportCard.vue'
import ReportLayout from '@/presentation/components/ReportLayout.vue'
import SampleStatement from '@/presentation/components/SampleStatement.vue'
import SectionNav from '@/presentation/components/SectionNav.vue'
import SegmentedControl from '@/presentation/components/SegmentedControl.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import ThemeToggle from '@/presentation/components/ThemeToggle.vue'
import { useTheme } from '@/presentation/composables/useTheme'
import { LEDGER_ROWS, dreRows } from '@/test/fixtures'
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

  it('mostra variação de margem em pontos percentuais', () => {
    const wrapper = mount(StatCard, { props: { label: 'Margem', value: '22%', delta: 0.02, deltaUnit: 'points' } })
    expect(wrapper.text()).toContain('+2,0 p.p.')
  })
})

describe('SampleStatement', () => {
  const lines = [
    { label: 'Receita bruta', value: 1000, kind: 'start' },
    { label: 'Custos', value: -400, kind: 'step' },
    { label: 'Resultado', value: 600, kind: 'total' },
  ] as const

  const mountReceipt = (items: readonly { label: string; value: number; kind: 'start' | 'step' | 'total' }[] = lines) =>
    mount(SampleStatement, { props: { lines: items, caption: 'DRE de exemplo', issuer: 'Cafeteria' } })

  it('lista as linhas numa tabela com emissor e legenda', () => {
    const wrapper = mountReceipt()
    expect(wrapper.get('caption').text()).toBe('Cafeteria DRE de exemplo')
    expect(wrapper.findAll('tbody th').map((th) => th.text())).toEqual(['Receita bruta', 'Custos'])
    const cost = wrapper.findAll('tbody td')[1]!
    expect(cost.text()).toBe('-400')
    expect(cost.classes()).toContain('text-paper-loss')
  })

  it('fecha com o resultado, a margem e o carimbo no azul', () => {
    const text = mountReceipt().text()
    expect(text).toMatch(/Resultado\s*R\$\s?600/)
    expect(text).toContain('60% da receita')
    expect(text).toContain('No azul')
  })

  it('carimba no vermelho quando o resultado é negativo', () => {
    const wrapper = mountReceipt([
      { label: 'Receita bruta', value: 1000, kind: 'start' },
      { label: 'Custos', value: -1200, kind: 'step' },
      { label: 'Resultado', value: -200, kind: 'total' },
    ])
    expect(wrapper.text()).toContain('No vermelho')
    expect(wrapper.text()).toContain('-20% da receita')
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

describe('ReportLayout', () => {
  it('mostra os controles junto da navegação, que acompanha a rolagem', () => {
    const wrapper = mount(ReportLayout, {
      props: { sections: [{ id: 'a', label: 'A' }] },
      slots: { controls: '<button>Período</button>', default: '<section id="a" />' },
    })
    expect(wrapper.get('nav').text()).toContain('Período')
    expect(wrapper.get('nav').classes()).toContain('sticky')
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

describe('ReportCard', () => {
  const mountCard = (removable = false) =>
    mountWithProviders(ReportCard, {
      props: { title: 'DRE 2026', subtitle: '12 meses', to: '/dre/1', removable },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

  it('tem um link "Visualizar" que cobre o card inteiro', () => {
    const link = mountCard().getComponent(RouterLinkStub)
    expect(link.props('to')).toBe('/dre/1')
    expect(link.text()).toContain('Visualizar')
    expect(link.classes()).toContain('after:absolute')
  })

  it('emite a remoção sem navegar', async () => {
    const wrapper = mountCard(true)
    await wrapper.get('button[aria-label="Remover DRE 2026"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})

describe('DreTable', () => {
  const report = DreReport.fromTable({ name: 'DRE', sheet: 'DRE Geral', rows: dreRows() })!
  const mountTable = () => mountWithProviders(DreTable, { props: { report, highlight: [2] } })
  const rowLabels = (wrapper: ReturnType<typeof mountTable>) => wrapper.findAll('tbody th').map((th) => th.text())

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

  it('pinta os totais e resultados com a cor de destaque, e os negativos das contas de vermelho', async () => {
    const wrapper = mountTable()
    await wrapper.findAll('tbody button').find((b) => b.text() === 'Despesas com pessoal')!.trigger('click')
    const row = (label: string) => wrapper.findAll('tbody tr').find((tr) => tr.get('th').text() === label)!
    const colors = (label: string) => row(label).findAll('td').map((td) => (td.classes('text-total') ? 'total' : td.classes('text-destructive') ? 'negativo' : 'normal'))
    expect(colors('Receita operacional bruta')).toEqual(['total', 'total', 'total'])
    expect(colors('Despesas operacionais')).toEqual(['total', 'total', 'total'])
    expect(colors('Salários')).toEqual(['negativo', 'negativo', 'negativo'])
  })

  it('destaca a coluna do período selecionado', () => {
    expect(mountTable().get('[data-highlight]').text()).toBe('mar/26')
  })

  it('sem aba de lançamentos, os valores não são clicáveis', () => {
    expect(mountTable().find('tbody td button').exists()).toBe(false)
  })

  it('abre os lançamentos que compõem um valor ao clicar', async () => {
    const withLedger = DreReport.fromTables([
      { name: 'DRE', sheet: 'DRE Geral', rows: dreRows() },
      { name: 'Fluxo', sheet: 'Fluxo de Caixa', rows: LEDGER_ROWS },
    ])!
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
    const withLedger = DreReport.fromTables([
      { name: 'DRE', sheet: 'DRE Geral', rows: dreRows() },
      { name: 'Fluxo', sheet: 'Fluxo de Caixa', rows: LEDGER_ROWS },
    ])!
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
  const breakdown = {
    label: 'DESPESAS OPERACIONAIS',
    period: { year: 2026, month: 3 },
    value: -700,
    total: -600,
    difference: -100,
    entries: [
      { date: '2026-03-05', description: 'Folha', classification: 'Salários', unit: 'Matriz', value: -350, period: { year: 2026, month: 3 } },
      { date: '2026-03-10', description: '', classification: 'Aluguel', unit: '', value: -250, period: { year: 2026, month: 3 } },
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

  it('avisa quando não há lançamentos pagos no mês', () => {
    const wrapper = mount(CellBreakdown, { props: { breakdown: { ...breakdown, entries: [], accounts: [], total: 0 } } })
    expect(wrapper.text()).toContain('Nenhum lançamento desta conta foi pago neste mês')
  })
})

describe('SectionNav', () => {
  const sections = [
    { id: 'indicadores', label: 'Indicadores' },
    { id: 'lucro', label: 'Lucro', nested: true },
  ]

  it('lista as seções como links para as âncoras', () => {
    const wrapper = mount(SectionNav, { props: { sections } })
    const links = wrapper.findAll('a')
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['Indicadores', '#indicadores'],
      ['Lucro', '#lucro'],
    ])
  })

  it('rola suavemente até a seção clicada e a marca como atual', async () => {
    const target = document.createElement('section')
    target.id = 'lucro'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    const wrapper = mount(SectionNav, { props: { sections }, attachTo: document.body })
    await wrapper.findAll('a')[1]!.trigger('click')

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBe('location')

    wrapper.unmount()
    target.remove()
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

    await items[0]!.trigger('click')
    expect(useTheme().preference.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
