import { describe, expect, it } from 'vitest'
import { AnalyzeDreUseCase } from '@/application'
import { DreReport } from '@/domain/dre'
import { dreRows } from '@/test/fixtures'
import { buildDreInsights } from '@/presentation/composables/useDreAnalysis'

const titles = (insights: readonly { title: string }[]) => insights.map((i) => i.title)

describe('buildDreInsights', () => {
  const report = DreReport.fromTable({ sheet: 'DRE Geral', rows: dreRows() })!
  const analysis = new AnalyzeDreUseCase().execute(report, { type: 'month', index: 2 })
  const insights = buildDreInsights(report, analysis, { previous: 'fev/26', window: 'até mar/26', when: 'em mar/26' })

  it('gera os pontos de análise esperados com tom e explicação', () => {
    expect(titles(insights)).toEqual([
      'Receita em queda',
      'Operação no prejuízo',
      'Ponto de equilíbrio',
      'Maior peso nos custos',
      'Consistência do resultado',
      'Caixa saudável',
      'Melhor mês de receita',
      'Margem de contribuição média',
    ])
    expect(insights.find((i) => i.title === 'Receita em queda')?.description).toContain('caiu 25%')
    expect(insights.find((i) => i.title === 'Operação no prejuízo')?.tone).toBe('negative')
    expect(insights.every((i) => i.explanation.length > 20)).toBe(true)
  })

  it('diz em quais meses se baseia', () => {
    const description = (title: string) => insights.find((i) => i.title === title)?.description
    expect(description('Consistência do resultado')).toBe('EBITDA positivo em 2 dos 3 meses até mar/26.')
    expect(description('Melhor mês de receita')).toContain('entre os 3 meses até mar/26')
  })

  it('omite tendências quando o período tem um mês só', () => {
    const january = new AnalyzeDreUseCase().execute(report, { type: 'month', index: 0 })
    const titlesOfJanuary = titles(buildDreInsights(report, january, { previous: '', window: 'até jan/26', when: 'em jan/26' }))
    expect(titlesOfJanuary).not.toContain('Consistência do resultado')
    expect(titlesOfJanuary).not.toContain('Melhor mês de receita')
    expect(titlesOfJanuary).not.toContain('Margem de contribuição média')
  })
})


describe('textos com números fora do comum', () => {
  const report = DreReport.fromTable({ sheet: 'DRE Geral', rows: dreRows() })!
  const base = new AnalyzeDreUseCase().execute(report, { type: 'year', year: 2026 })
  const labels = { previous: '', window: 'de 2026', when: 'no acumulado de 2026' }
  const describe_ = (facts: Partial<typeof base.facts>, title: string) =>
    buildDreInsights(report, { ...base, facts: { ...base.facts, ...facts } }, labels).find((i) => i.title === title)!

  it('com margem de contribuição negativa, não fala em "sobram R$ -27"', () => {
    const insight = describe_({ averageContributionMargin: -0.268 }, 'Margem de contribuição média')
    expect(insight.description).toContain('os custos variáveis passam R$ 27 da receita')
    expect(insight.description).not.toContain('sobram')
    expect(insight.tone).toBe('negative')
  })

  it('aponta quando um grupo de despesas passa da receita', () => {
    const insight = describe_({ topExpense: { label: 'DESPESAS GERAIS', value: 400, share: 3.968 } }, 'Maior peso nos custos')
    expect(insight.description).toBe('Despesas gerais: 396,8% da receita, mais do que tudo o que foi vendido.')
  })
})
