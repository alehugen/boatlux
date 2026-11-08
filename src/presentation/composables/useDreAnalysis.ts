import { computed, ref, watch } from 'vue'
import type { DreAnalysis, DreSelection } from '@/application'
import { DEFAULT_BASIS, DreMetric, sameBasis, type DreBasis, type DreReport } from '@/domain/dre'
import { periodKey, type Period } from '@/domain/shared'
import type { Insight } from '@/domain/analysis'
import { container } from '@/infrastructure/container'
import {
  formatCurrencyCompact,
  formatPercent,
  formatPeriod,
  formatPeriodLong,
  prettifyLabel,
} from '@/presentation/format'
import { useReport } from './useReport'

export const DRE_METRIC_LABELS: Record<DreMetric, string> = {
  grossRevenue: 'Receita bruta',
  salesTaxes: 'Impostos sobre venda',
  grossProfit: 'Lucro bruto',
  contributionMargin: 'Margem de contribuição',
  operatingExpenses: 'Despesas operacionais',
  ebitda: 'EBITDA',
  netIncome: 'Resultado líquido',
  openingCash: 'Saldo inicial',
  endingCash: 'Saldo de caixa',
}

export const DRE_MARGIN_LABELS: Partial<Record<DreMetric, string>> = {
  grossProfit: 'Margem bruta',
  contributionMargin: 'Margem de contribuição',
  ebitda: 'Margem EBITDA',
  netIncome: 'Margem líquida',
}

const COMPARISON = 'A variação compara com o mês anterior ou, no acumulado do ano, com os mesmos meses do ano anterior.'

export const DRE_METRIC_INFO: Record<DreMetric, string> = {
  grossRevenue: `Soma das receitas operacionais do período (linha "Receita operacional bruta" da DRE). ${COMPARISON}`,
  salesTaxes: `Impostos sobre as vendas do período. ${COMPARISON}`,
  grossProfit: `Receita bruta − impostos sobre venda − custos das mercadorias e dos serviços vendidos. Margem bruta = lucro bruto ÷ receita bruta. ${COMPARISON}`,
  contributionMargin: `Lucro bruto − despesas variáveis: o que sobra das vendas para pagar as despesas fixas. Percentual = margem ÷ receita bruta. ${COMPARISON}`,
  operatingExpenses: `Soma das despesas fixas da operação (pessoal, aluguel, serviços...). ${COMPARISON}`,
  ebitda: `Margem de contribuição − despesas operacionais + outras receitas operacionais. Mostra o resultado da operação antes de itens não desembolsáveis e movimentações não operacionais. ${COMPARISON}`,
  netIncome: `EBITDA − despesas não desembolsáveis ± entradas e saídas não operacionais (aplicações, transferências). Margem líquida = resultado ÷ receita bruta. ${COMPARISON}`,
  openingCash: 'Saldo de caixa no início do primeiro mês do período, pelos lançamentos "Saldo inicial" do fluxo de caixa.',
  endingCash: 'Saldo final de caixa do último mês do período (saldo inicial + variação do mês). Não é somado entre meses. A variação compara com o saldo do período anterior.',
}

const selectionKey = (s: DreSelection, periods: readonly Period[]) =>
  s.type === 'month' ? `m:${periods[s.index] ? periodKey(periods[s.index]!) : s.index}` : `y:${s.year}`

export function useDreAnalysis() {
  const { report: imported } = useReport()

  /** Regime (caixa ou competência) e unidade: começa no que estava escolhido na planilha. */
  const basis = ref<DreBasis>(imported.value?.basis ?? DEFAULT_BASIS)
  watch(imported, (current) => (basis.value = current?.basis ?? DEFAULT_BASIS))
  const setBasis = (next: DreBasis) => {
    if (!sameBasis(next, basis.value)) basis.value = next
  }
  const report = computed(() => imported.value?.withBasis(basis.value) ?? null)
  const periodsOf = () => report.value?.periods ?? []

  const selections = computed(() => (report.value ? container.analyzeDre.selections(report.value) : []))
  const selectedKey = ref('')
  watch(
    selections,
    (options) => {
      if (!options.some((o) => selectionKey(o, periodsOf()) === selectedKey.value)) {
        selectedKey.value = options[0] ? selectionKey(options[0], periodsOf()) : ''
      }
    },
    { immediate: true },
  )

  const selection = computed(() => selections.value.find((o) => selectionKey(o, periodsOf()) === selectedKey.value) ?? null)

  const analysis = computed(() =>
    report.value && selection.value ? container.analyzeDre.execute(report.value, selection.value) : null,
  )

  const labelOf = (s: DreSelection) =>
    s.type === 'year' ? `Acumulado ${s.year}` : report.value ? formatPeriod(report.value.periods[s.index]!) : ''

  const periodLabels = computed(() => {
    const r = report.value
    const a = analysis.value
    const s = selection.value
    if (!r || !a || !s) return { currentLong: '', previous: '', reference: '', window: '', when: '', heading: '' }
    const span = (indexes: number[]) => {
      const first = formatPeriod(r.periods[indexes[0]!]!)
      const last = formatPeriod(r.periods[indexes.at(-1)!]!)
      return first === last ? first : `${first} a ${last}`
    }
    const previous = a.previousIndexes ? span(a.previousIndexes) : ''
    return {
      currentLong: s.type === 'month' ? formatPeriodLong(r.periods[s.index]!) : `acumulado de ${s.year}`,
      previous,
      reference: s.type === 'month' ? `em ${labelOf(s)}` : `na média mensal de ${s.year}`,
      window: s.type === 'month' ? `até ${labelOf(s)}` : `de ${s.year}`,
      when: s.type === 'month' ? `em ${labelOf(s)}` : `no acumulado de ${s.year}`,
      heading: s.type === 'month' ? `Resultado de ${formatPeriodLong(r.periods[s.index]!)}` : `Resultado acumulado de ${s.year}`,
    }
  })

  const insights = computed(() =>
    report.value && analysis.value ? buildDreInsights(report.value, analysis.value, periodLabels.value) : [],
  )

  const profitTargetFor = (sourceIds: readonly string[] | null) =>
    report.value && selection.value ? container.analyzeDre.profitTargetFor(report.value, selection.value, sourceIds) : null

  return {
    report,
    basis: computed(() => report.value?.basis ?? basis.value),
    setBasis,
    profitTargetFor,
    selections: computed(() => selections.value.map((s) => ({ key: selectionKey(s, periodsOf()), label: labelOf(s), type: s.type }))),
    selectedKey,
    analysis,
    periodLabels,
    insights,
  }
}

export function buildDreInsights(
  report: DreReport,
  analysis: DreAnalysis,
  labels: { previous: string; window: string; when: string },
): Insight[] {
  const { facts, kpis, breakEven } = analysis
  const items: Insight[] = []
  const kpi = (metric: DreMetric) => kpis.find((k) => k.metric === metric)
  const months = facts.windowIndexes.length
  const window = `${months} meses ${labels.window}`

  if (facts.revenueChange !== null && labels.previous) {
    const up = facts.revenueChange >= 0
    items.push({
      title: up ? 'Receita em alta' : 'Receita em queda',
      description: `A receita bruta ${up ? 'cresceu' : 'caiu'} ${formatPercent(Math.abs(facts.revenueChange))} em relação a ${labels.previous}.`,
      tone: up ? 'positive' : 'negative',
      explanation: `(Receita bruta do período − receita bruta de ${labels.previous}) ÷ receita bruta de ${labels.previous}. No acumulado do ano, compara com os mesmos meses do ano anterior.`,
    })
  }

  const ebitda = kpi(DreMetric.Ebitda)
  if (ebitda) {
    const positive = ebitda.value >= 0
    items.push({
      title: positive ? 'Operação lucrativa' : 'Operação no prejuízo',
      description: `EBITDA de ${formatCurrencyCompact(ebitda.value)} ${labels.when}${ebitda.margin !== null ? `, margem de ${formatPercent(ebitda.margin)}` : ''}.`,
      tone: positive ? 'positive' : 'negative',
      explanation: 'EBITDA é o resultado da operação antes de itens não desembolsáveis e movimentações não operacionais. Margem EBITDA = EBITDA ÷ receita bruta. Positivo indica operação lucrativa no período.',
    })
  }

  if (breakEven) {
    const gap = breakEven.actual / breakEven.revenue - 1
    items.push({
      title: 'Ponto de equilíbrio',
      description: `São necessários ${formatCurrencyCompact(breakEven.revenue)} de receita ${labels.when} para cobrir as despesas operacionais; a receita ficou ${formatPercent(Math.abs(gap))} ${gap >= 0 ? 'acima' : 'abaixo'}.`,
      tone: gap >= 0 ? 'positive' : 'negative',
      explanation: 'Despesas operacionais (fixas) ÷ margem de contribuição % do período. É a receita em que a margem de contribuição cobre exatamente as despesas operacionais, mantida a margem atual. Outras receitas, depreciação e itens não operacionais não entram. A diferença compara a receita real com esse valor.',
    })
  }

  if (facts.topExpense) {
    items.push({
      title: 'Maior peso nos custos',
      description: `${prettifyLabel(facts.topExpense.label)}: ${formatPercent(facts.topExpense.share)} da receita${facts.topExpense.share > 1 ? ', mais do que tudo o que foi vendido' : ''}.`,
      tone: 'neutral',
      explanation: 'Entre os grupos de custos e despesas anteriores ao EBITDA, o de maior valor no período, dividido pela receita bruta.',
    })
  }

  if (facts.positiveEbitdaMonths !== null && months > 1) {
    const ratio = facts.positiveEbitdaMonths / months
    items.push({
      title: 'Consistência do resultado',
      description: `EBITDA positivo em ${facts.positiveEbitdaMonths} dos ${window}.`,
      tone: ratio >= 0.5 ? 'positive' : 'negative',
      explanation: `Quantidade de meses com EBITDA acima de zero nos ${window}. No mês selecionado, olha até 12 meses terminando nele; no acumulado, os meses do ano. Fica positivo a partir de metade dos meses.`,
    })
  }

  if (facts.negativeCashMonths !== null && months > 1) {
    const explanation = `Quantidade de meses com saldo final de caixa abaixo de zero nos ${window}.`
    items.push(
      facts.negativeCashMonths
        ? {
            title: 'Pressão no caixa',
            description: `O saldo de caixa terminou negativo em ${facts.negativeCashMonths} dos ${window}.`,
            tone: 'negative',
            explanation,
          }
        : {
            title: 'Caixa saudável',
            description: `O saldo de caixa ficou positivo em todos os ${window}.`,
            tone: 'positive',
            explanation,
          },
    )
  }

  if (facts.bestRevenue) {
    items.push({
      title: 'Melhor mês de receita',
      description: `${formatPeriodLong(report.periods[facts.bestRevenue.index]!)} com ${formatCurrencyCompact(facts.bestRevenue.value)}, entre os ${window}.`,
      tone: 'neutral',
      explanation: `Mês com a maior receita bruta entre os ${window}.`,
    })
  }

  if (facts.averageContributionMargin !== null && months > 1) {
    const per100 = Math.round(Math.abs(facts.averageContributionMargin) * 100)
    const positive = facts.averageContributionMargin >= 0
    items.push({
      title: 'Margem de contribuição média',
      description: positive
        ? `${formatPercent(facts.averageContributionMargin)} nos ${window}: de cada R$ 100 vendidos, sobram R$ ${per100} para pagar as despesas fixas.`
        : `${formatPercent(facts.averageContributionMargin)} nos ${window}: de cada R$ 100 vendidos, os custos variáveis passam R$ ${per100} da receita e não sobra nada para as despesas fixas.`,
      tone: positive ? 'neutral' : 'negative',
      explanation: `Soma da margem de contribuição ÷ soma da receita bruta dos ${window}. Meses que vendem mais pesam mais na média.`,
    })
  }

  return items
}
