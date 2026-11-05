import { describe, expect, it } from 'vitest'
import { DreMetric, DreReport } from '@/domain/dre'
import { DRE_LINES, LEDGER_ROWS, dreRows } from '@/test/fixtures'
import { AnalyzeDreUseCase } from '@/application'

const report = DreReport.fromTable({ name: 'DRE Geral', sheet: 'DRE Geral', rows: dreRows() })!
const useCase = new AnalyzeDreUseCase()
const march = useCase.execute(report, { type: 'month', index: 2 })
const year = useCase.execute(report, { type: 'year', year: 2026 })
const kpi = (analysis: typeof march, metric: DreMetric) => analysis.kpis.find((k) => k.metric === metric)!

describe('AnalyzeDreUseCase.selections', () => {
  it('lista os meses (mais recente primeiro) e depois os anos', () => {
    expect(useCase.selections(report)).toEqual([
      { type: 'month', index: 2 },
      { type: 'month', index: 1 },
      { type: 'month', index: 0 },
      { type: 'year', year: 2026 },
    ])
  })
})

describe('indicadores', () => {
  it('calcula valor, margem e comparação com o mês anterior', () => {
    expect(kpi(march, DreMetric.GrossRevenue)).toEqual({ metric: 'grossRevenue', value: 900, previous: 1200, margin: null })
    expect(kpi(march, DreMetric.Ebitda).value).toBe(-70)
    expect(kpi(march, DreMetric.Ebitda).margin).toBeCloseTo(-70 / 900)
    expect(kpi(march, DreMetric.EndingCash)).toMatchObject({ value: 290, previous: 360, margin: null })
  })

  it('não compara o primeiro mês nem um ano sem o ano anterior', () => {
    expect(useCase.execute(report, { type: 'month', index: 0 }).previousIndexes).toBeNull()
    expect(year.previousIndexes).toBeNull()
  })

  it('soma fluxos e pega o último saldo no acumulado do ano', () => {
    expect(kpi(year, DreMetric.GrossRevenue).value).toBe(3100)
    expect(kpi(year, DreMetric.EndingCash).value).toBe(290)
  })
})

describe('custos, ponto de equilíbrio e séries', () => {
  it('ordena os grupos de custo antes do EBITDA pelo valor', () => {
    expect(march.expenses.map((e) => [e.label, e.value])).toEqual([
      ['DESPESAS COM PESSOAL', 350],
      ['CUSTOS DAS MERCADORIAS VENDIDAS', 280],
      ['DESPESAS GERAIS', 250],
      ['IMPOSTOS SOBRE VENDA', 90],
    ])
    expect(march.expenses[0]!.share).toBeCloseTo(350 / 900)
  })

  it('calcula o ponto de equilíbrio pela margem de contribuição', () => {
    expect(march.breakEven!.revenue).toBeCloseTo(600 / (530 / 900))
    expect(march.breakEven!.actual).toBe(900)
  })

  it('coincide com a meta de lucro zero, no mês e no acumulado', () => {
    for (const analysis of [march, year]) {
      const zero = useCase.projectProfitTarget(analysis.profitTarget!, 0)
      if (zero.status === 'unreachable') throw new Error('meta deveria ser alcançável')
      expect(analysis.breakEven!.revenue).toBeCloseTo(zero.revenue * analysis.profitTarget!.months)
    }
  })

  it('monta as séries mensais', () => {
    expect(march.monthly.revenue).toEqual([1000, 1200, 900])
    expect(march.monthly.ebitda).toEqual([100, 210, -70])
    expect(march.monthly.cash).toEqual([150, 360, 290])
    expect(march.monthly.revenueMix.map((s) => s.label)).toEqual(['Serviços', 'Produtos'])
  })
})

describe('fatos', () => {
  it('resume tendência e destaques', () => {
    expect(march.facts).toMatchObject({
      revenueChange: -0.25,
      bestRevenue: { index: 1, value: 1200 },
      windowIndexes: [0, 1, 2],
      positiveEbitdaMonths: 2,
      negativeCashMonths: 0,
    })
    expect(march.facts.topExpense?.label).toBe('DESPESAS COM PESSOAL')
  })

  it('pondera a margem de contribuição média pela receita', () => {
    expect(march.facts.averageContributionMargin).toBeCloseTo((600 + 730 + 530) / (1000 + 1200 + 900))
  })
})

describe('janela dos fatos', () => {
  const withDecember = DreReport.fromTable({
    name: 'DRE',
    sheet: 'DRE Geral',
    rows: dreRows({ lines: DRE_LINES.map((line) => line && ([line[0], line[2]! * 5, ...line.slice(2)] as typeof line)) }),
  })!
  const facts = (selection: Parameters<typeof useCase.execute>[1]) => useCase.execute(withDecember, selection).facts

  it('no acumulado do ano, usa só os meses daquele ano', () => {
    expect(withDecember.periods[0]).toEqual({ year: 2025, month: 12 })
    const year2026 = facts({ type: 'year', year: 2026 })
    expect(year2026.windowIndexes).toEqual([1, 2, 3])
    expect(year2026.bestRevenue).toEqual({ index: 2, value: 1200 })
    expect(year2026.averageContributionMargin).toBeCloseTo((600 + 730 + 530) / (1000 + 1200 + 900))
  })

  it('no mês, olha só para trás: nunca inclui meses depois do selecionado', () => {
    const january = facts({ type: 'month', index: 1 })
    expect(january.windowIndexes).toEqual([0, 1])
    expect(january.bestRevenue).toEqual({ index: 0, value: 5000 })
    expect(facts({ type: 'month', index: 0 }).bestRevenue).toBeNull()
  })
})

describe('composição de uma célula', () => {
  const withLedger = DreReport.fromTables([
    { name: 'DRE', sheet: 'DRE Geral', rows: dreRows() },
    { name: 'Fluxo', sheet: 'Fluxo de Caixa', rows: LEDGER_ROWS },
  ])!
  const lineId = (label: string) => withLedger.lines.find((line) => line.label === label)!.id

  it('lista os lançamentos da conta no mês e confere com a DRE', () => {
    const breakdown = useCase.breakdown(withLedger, lineId('Salários'), 2)!
    expect(breakdown).toMatchObject({ label: 'Salários', period: { year: 2026, month: 3 }, value: -350, total: -350, difference: 0 })
    expect(breakdown.entries.map((entry) => entry.date)).toEqual(['2026-03-05', '2026-03-20'])
  })

  it('soma por conta quando a linha é uma seção', () => {
    const breakdown = useCase.breakdown(withLedger, lineId('DESPESAS OPERACIONAIS'), 2)!
    expect(breakdown.accounts).toEqual([
      { label: 'Salários', total: -350, count: 2 },
      { label: 'Aluguel', total: -250, count: 1 },
    ])
    expect(breakdown.difference).toBe(0)
  })

  it('mostra a diferença quando faltam lançamentos', () => {
    const breakdown = useCase.breakdown(withLedger, lineId('Salários'), 1)!
    expect(breakdown).toMatchObject({ value: -300, total: -300, difference: 0 })
    const missing = useCase.breakdown(withLedger, lineId('Simples Nacional'), 2)!
    expect(missing).toMatchObject({ value: -90, total: 0, difference: -90, entries: [] })
  })

  it('não detalha sem lançamentos importados nem linhas de resultado', () => {
    expect(useCase.breakdown(report, report.lines[1]!.id, 2)).toBeNull()
    expect(useCase.breakdown(withLedger, lineId('MARGEM DE CONTRIBUIÇÃO'), 2)).toBeNull()
  })
})

describe('meta de lucro', () => {
  const base = march.profitTarget!

  it('usa as despesas operacionais como fixas e o resultado operacional como lucro', () => {
    expect(base).toMatchObject({ months: 1, revenue: 900, profit: -70, fixedCosts: 600 })
    expect(base.contributionRatio).toBeCloseTo(530 / 900)
  })

  it('no acumulado, usa a média mensal das despesas operacionais, como na receita', () => {
    expect(year.profitTarget).toMatchObject({ months: 3, fixedCosts: (500 + 520 + 600) / 3 })
    expect(year.profitTarget!.revenue).toBeCloseTo((1000 + 1200 + 900) / 3)
  })

  it('calcula a receita que gera o lucro desejado e a conta fecha', () => {
    const projection = useCase.projectProfitTarget(base, 100)
    if (projection.status === 'unreachable') throw new Error('meta deveria ser alcançável')
    expect(projection.status).toBe('pending')
    expect(projection.revenue).toBeCloseTo(700 / (530 / 900))
    expect(projection.revenue - projection.variableCosts - projection.fixedCosts).toBeCloseTo(100)
    expect(projection.revenueGap).toBeCloseTo(projection.revenue - 900)
    expect(projection.revenueChange).toBeCloseTo(projection.revenue / 900 - 1)
  })

  it('lista as contas que compõem a receita bruta no período', () => {
    expect(march.revenueSources.map(({ label, value }) => [label, value])).toEqual([
      ['Serviços', 300],
      ['Produtos', 600],
    ])
  })

  it('toma só a receita escolhida como receita bruta, mantendo custos e despesas', () => {
    const products = march.revenueSources.find((source) => source.label === 'Produtos')!
    const onlyProducts = useCase.profitTargetFor(report, { type: 'month', index: 2 }, [products.id])!
    expect(onlyProducts).toMatchObject({ revenue: 600, revenueLabel: 'Produtos', excludedRevenue: 300, fixedCosts: 600 })
    expect(onlyProducts.contributionRatio).toBeCloseTo((530 - 300) / 600)
    expect(onlyProducts.profit).toBeCloseTo(530 - 300 - 600)

    const projection = useCase.projectProfitTarget(onlyProducts, 100)
    if (projection.status === 'unreachable') throw new Error('meta deveria ser alcançável')
    expect(projection.revenue).toBeCloseTo((600 + 100) / ((530 - 300) / 600))
    expect(projection.revenue - projection.variableCosts - projection.fixedCosts).toBeCloseTo(100)
  })

  it('sem escolha, usa a receita bruta inteira', () => {
    expect(useCase.profitTargetFor(report, { type: 'month', index: 2 }, null)).toEqual(base)
  })

  it('lista os grupos de despesas operacionais do maior para o menor', () => {
    expect(base.fixedGroups).toEqual([
      { label: 'DESPESAS COM PESSOAL', value: 350 },
      { label: 'DESPESAS GERAIS', value: 250 },
    ])
  })

  it('calcula caminhos que fecham sozinhos a diferença até a meta', () => {
    const projection = useCase.projectProfitTarget(base, 100)
    if (projection.status === 'unreachable' || !projection.paths) throw new Error('esperava caminhos')
    const { paths } = projection
    expect(paths.gap).toBe(170)
    expect(paths.sales.amount).toBeCloseTo(170 / (530 / 900))
    expect(paths.sales.amount).toBeCloseTo(projection.revenueGap)
    expect(paths.price).toBeCloseTo(170 / (900 * 0.9))
    expect(paths.purchases!.share).toBeCloseTo(170 / 280)
    expect(paths.fixed!.share).toBeCloseTo(170 / 600)
    const combined = paths.combined!
    expect(combined.fronts).toBe(3)
    expect(combined.fixed).toBeCloseTo(170 / 3)
    expect(combined.sales * (530 / 900) + combined.price! * 810 + combined.fixed!).toBeCloseTo(170)
  })

  it('divide o plano combinado só entre as frentes possíveis, cobrindo toda a diferença', () => {
    const withoutPrice = { ...base, variableLines: [{ label: 'IMPOSTOS', value: 900, kind: 'taxes' as const, ratio: 1 }] }
    const noPrice = useCase.projectProfitTarget({ ...withoutPrice, contributionRatio: 530 / 900 }, 100)
    if (noPrice.status === 'unreachable' || !noPrice.paths) throw new Error('esperava caminhos')
    const halves = noPrice.paths.combined!
    expect(halves).toMatchObject({ fronts: 2, price: null })
    expect(halves.sales * (530 / 900) + halves.fixed!).toBeCloseTo(170)

    const noFixed = useCase.projectProfitTarget({ ...base, fixedCosts: 0, profit: base.profit }, 100)
    if (noFixed.status === 'unreachable' || !noFixed.paths) throw new Error('esperava caminhos')
    expect(noFixed.paths.combined).toMatchObject({ fronts: 2, fixed: null })

    const onlySales = useCase.projectProfitTarget({ ...withoutPrice, fixedCosts: 0 }, 10_000)
    if (onlySales.status === 'unreachable' || !onlySales.paths) throw new Error('esperava caminhos')
    expect(onlySales.paths.combined).toBeNull()
  })

  it('não sugere cortar mais do que existe nem caminhos para meta já batida', () => {
    const big = useCase.projectProfitTarget(base, 10_000)
    if (big.status === 'unreachable') throw new Error('meta deveria ser alcançável')
    expect(big.paths).toMatchObject({ purchases: null, fixed: null })
    expect(useCase.projectProfitTarget({ ...base, profit: 150 }, 100)).toMatchObject({ paths: null })
  })

  it('separa as linhas variáveis por tipo', () => {
    expect(base.variableLines).toEqual([
      { label: 'IMPOSTOS SOBRE VENDA', value: 90, kind: 'taxes', ratio: 0.1 },
      { label: 'CUSTOS DAS MERCADORIAS VENDIDAS', value: 280, kind: 'purchases', ratio: 280 / 900 },
    ])
    expect(base.excludedLines).toEqual([])
  })

  it('projeta cada custo variável na proporção da receita e destaca as compras a mais', () => {
    const projection = useCase.projectProfitTarget(base, 100)
    if (projection.status === 'unreachable') throw new Error('meta deveria ser alcançável')
    const purchases = projection.variableLines.find((line) => line.kind === 'purchases')!
    expect(purchases.projected).toBeCloseTo((280 / 900) * projection.revenue)
    expect(projection.purchasesChange).toBeCloseTo(purchases.projected - 280)
    expect(projection.variableLines.reduce((total, line) => total + line.projected, 0)).toBeCloseTo(projection.variableCosts)
  })

  it('não estima compras quando a DRE não tem linhas de custo das vendas', () => {
    const projection = useCase.projectProfitTarget({ ...base, variableLines: base.variableLines.filter((l) => l.kind !== 'purchases') }, 100)
    expect(projection).toMatchObject({ purchasesChange: null })
  })

  it('marca a meta como atingida quando o lucro do período já chega lá', () => {
    expect(useCase.projectProfitTarget({ ...base, profit: 150 }, 100)).toMatchObject({ status: 'reached', paths: null })
  })

  it('pede receita zero quando a meta cabe nas despesas negativas', () => {
    const projection = useCase.projectProfitTarget({ ...base, fixedCosts: -500, profit: 600 }, 100)
    expect(projection).toMatchObject({ status: 'reached', revenue: 0 })
  })

  it('não projeta com margem de contribuição zerada ou negativa', () => {
    expect(useCase.projectProfitTarget({ ...base, contributionRatio: -0.1 }, 100)).toEqual({ status: 'unreachable', target: 100 })
  })

  it('usa a média mensal no acumulado do ano', () => {
    const yearly = year.profitTarget!
    expect(yearly.months).toBe(3)
    expect(yearly.revenue).toBeCloseTo(3100 / 3)
  })
})
