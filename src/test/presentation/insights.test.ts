import { describe, expect, it } from 'vitest'
import { AnalyzeDreUseCase } from '@/application'
import { DreReport } from '@/domain/dre'
import { dreRows } from '@/test/fixtures'
import { buildDreInsights } from '@/presentation/composables/useDreAnalysis'

const titles = (insights: readonly { title: string }[]) => insights.map((i) => i.title)

describe('buildDreInsights', () => {
  const report = DreReport.fromTable({ name: 'DRE', sheet: 'DRE Geral', rows: dreRows() })!
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

