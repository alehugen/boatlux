import { DreLineKind, DreMetric, type DreLine, type DreReport, type LedgerEntry } from '@/domain/dre'
import { normalizeText, ratio, relativeChange, sum, type Period } from '@/domain/shared'

export type DreSelection = { type: 'month'; index: number } | { type: 'year'; year: number }

export interface DreKpi {
  readonly metric: DreMetric
  readonly value: number
  readonly previous: number | null
  readonly margin: number | null
}

export interface DreExpense {
  readonly label: string
  readonly value: number
  readonly share: number
}

export type VariableCostKind = 'taxes' | 'purchases' | 'expenses'

export interface ProfitTargetLine {
  readonly label: string
  readonly value: number
}

export interface VariableCostLine extends ProfitTargetLine {
  readonly kind: VariableCostKind
  readonly ratio: number
}

export interface RevenueSource {
  readonly id: string
  readonly label: string
  readonly value: number
}

export interface ProfitTargetBase {
  readonly months: number
  readonly revenue: number
  readonly revenueLabel: string | null
  readonly excludedRevenue: number
  readonly profit: number
  readonly contributionRatio: number
  readonly fixedCosts: number
  readonly variableLines: readonly VariableCostLine[]
  readonly excludedLines: readonly ProfitTargetLine[]
  readonly fixedGroups: readonly ProfitTargetLine[]
}

export interface ProfitPaths {
  readonly gap: number
  readonly sales: { readonly amount: number; readonly change: number | null }
  readonly price: number | null
  readonly purchases: { readonly amount: number; readonly share: number } | null
  readonly fixed: { readonly amount: number; readonly share: number } | null
  readonly combined: {
    readonly fronts: number
    readonly sales: number
    readonly price: number | null
    readonly fixed: number | null
  } | null
}

export interface ProjectedCostLine extends VariableCostLine {
  readonly projected: number
  readonly change: number
}

export type ProfitTargetProjection =
  | { readonly status: 'unreachable'; readonly target: number }
  | {
      readonly status: 'pending' | 'reached'
      readonly target: number
      readonly revenue: number
      readonly variableCosts: number
      readonly fixedCosts: number
      readonly revenueGap: number
      readonly revenueChange: number | null
      readonly variableLines: readonly ProjectedCostLine[]
      readonly purchasesChange: number | null
      readonly paths: ProfitPaths | null
    }

export interface CellBreakdown {
  readonly label: string
  readonly period: Period
  readonly value: number
  readonly entries: readonly LedgerEntry[]
  readonly total: number
  readonly difference: number
  readonly accounts: readonly { readonly label: string; readonly total: number; readonly count: number }[]
}

export type ReachableProjection = Exclude<ProfitTargetProjection, { status: 'unreachable' }>

export interface DreAnalysis {
  readonly indexes: number[]
  readonly previousIndexes: number[] | null
  readonly kpis: DreKpi[]
  readonly breakEven: { readonly revenue: number; readonly actual: number } | null
  readonly profitTarget: ProfitTargetBase | null
  readonly revenueSources: RevenueSource[]
  readonly expenses: DreExpense[]
  readonly monthly: {
    readonly revenue: number[]
    readonly ebitda: number[] | null
    readonly cash: number[] | null
    readonly revenueMix: { readonly label: string; readonly values: number[] }[]
  }
  readonly facts: DreFacts
}

export interface DreFacts {
  readonly revenueChange: number | null
  readonly topExpense: DreExpense | null
  readonly bestRevenue: { readonly index: number; readonly value: number } | null
  readonly windowIndexes: readonly number[]
  readonly positiveEbitdaMonths: number | null
  readonly negativeCashMonths: number | null
  readonly averageContributionMargin: number | null
}

const KPI_METRICS: DreMetric[] = [
  DreMetric.GrossRevenue,
  DreMetric.GrossProfit,
  DreMetric.ContributionMargin,
  DreMetric.Ebitda,
  DreMetric.NetIncome,
  DreMetric.EndingCash,
]

const WITHOUT_MARGIN: DreMetric[] = [DreMetric.GrossRevenue, DreMetric.EndingCash]

const RECENT_WINDOW = 12

export class AnalyzeDreUseCase {
  selections(report: DreReport): DreSelection[] {
    const months = report.periods.map((_, index): DreSelection => ({ type: 'month', index }))
    const years = [...new Set(report.periods.map((p) => p.year))].map((year): DreSelection => ({ type: 'year', year }))
    return [...months.reverse(), ...years.reverse()]
  }

  execute(report: DreReport, selection: DreSelection): DreAnalysis {
    const indexes = this.resolve(report, selection)
    const previousIndexes = this.previousOf(report, selection, indexes)
    const allIndexes = report.periods.map((_, i) => i)

    const value = (metric: DreMetric, periodIndexes = indexes) => report.valueOf(report.metric(metric), periodIndexes)
    const monthlyOf = (metric: DreMetric) => (report.metric(metric) ? allIndexes.map((i) => value(metric, [i])) : null)

    const revenue = value(DreMetric.GrossRevenue)
    const kpis = KPI_METRICS.filter((metric) => report.metric(metric)).map((metric) => ({
      metric,
      value: value(metric),
      previous: previousIndexes ? value(metric, previousIndexes) : null,
      margin: WITHOUT_MARGIN.includes(metric) ? null : ratio(value(metric), revenue),
    }))

    const monthlyRevenue = allIndexes.map((i) => value(DreMetric.GrossRevenue, [i]))
    const monthly = {
      revenue: monthlyRevenue,
      ebitda: monthlyOf(DreMetric.Ebitda),
      cash: monthlyOf(DreMetric.EndingCash),
      revenueMix: this.revenueMix(report),
    }

    const expenses = this.expenses(report, indexes, revenue)
    const previousRevenue = previousIndexes ? value(DreMetric.GrossRevenue, previousIndexes) : null
    const profitTarget = this.profitTargetBase(report, indexes, revenue)

    return {
      indexes,
      previousIndexes,
      kpis,
      breakEven: this.breakEven(profitTarget),
      profitTarget,
      revenueSources: this.revenueSources(report, indexes),
      expenses,
      monthly,
      facts: {
        revenueChange: relativeChange(revenue, previousRevenue),
        topExpense: expenses[0] ?? null,
        ...this.trendFacts(report, monthly, this.windowOf(selection, indexes)),
      },
    }
  }

  breakdown(report: DreReport, lineId: string, periodIndex: number): CellBreakdown | null {
    const line = report.lines.find((candidate) => candidate.id === lineId)
    const period = report.periods[periodIndex]
    if (!line || !period || !report.isTraceable(line)) return null

    const entries = [...report.entriesOf(line, periodIndex)].sort((a, b) => a.date.localeCompare(b.date))
    const total = sum(entries.map((entry) => entry.value))
    const value = line.values[periodIndex] ?? 0
    const accounts = report
      .accountsOf(line)
      .map((account) => {
        const own = entries.filter((entry) => normalizeText(entry.classification) === normalizeText(account.label))
        return { label: account.label, total: sum(own.map((entry) => entry.value)), count: own.length }
      })
      .filter((account) => account.count > 0)
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))

    return { label: line.label, period, value, entries, total, difference: value - total, accounts }
  }

  projectProfitTarget(base: ProfitTargetBase, target: number): ProfitTargetProjection {
    if (base.contributionRatio <= 0) return { status: 'unreachable', target }

    const revenue = Math.max(0, (base.fixedCosts + target) / base.contributionRatio)
    const revenueGap = revenue - base.revenue
    const variableLines = base.variableLines.map((line) => {
      const projected = line.ratio * revenue
      return { ...line, projected, change: projected - line.value }
    })
    const purchases = variableLines.filter((line) => line.kind === 'purchases')
    const reached = target <= base.profit

    return {
      status: reached ? 'reached' : 'pending',
      target,
      revenue,
      variableCosts: revenue * (1 - base.contributionRatio),
      fixedCosts: base.fixedCosts,
      revenueGap,
      revenueChange: relativeChange(revenue, base.revenue),
      variableLines,
      purchasesChange: purchases.length ? sum(purchases.map((line) => line.change)) : null,
      paths: reached ? null : this.pathsTo(base, target - base.profit),
    }
  }

  private pathsTo(base: ProfitTargetBase, gap: number): ProfitPaths {
    const purchasesValue = sum(base.variableLines.filter((line) => line.kind === 'purchases').map((line) => line.value))
    const priceSensitive = sum(base.variableLines.filter((line) => line.kind !== 'purchases').map((line) => line.ratio))
    const priceBase = base.revenue * (1 - priceSensitive)
    const priceFor = (amount: number) => (priceBase > 0 ? amount / priceBase : null)
    const salesFor = (amount: number) => amount / base.contributionRatio
    const canCut = (amount: number) => base.fixedCosts > 0 && amount <= base.fixedCosts
    const withPrice = priceBase > 0
    const withFixed = canCut(gap / (withPrice ? 3 : 2))
    const fronts = 1 + Number(withPrice) + Number(withFixed)
    const share = gap / fronts

    return {
      gap,
      sales: { amount: salesFor(gap), change: ratio(salesFor(gap), base.revenue) },
      price: priceFor(gap),
      purchases: purchasesValue > 0 && gap <= purchasesValue ? { amount: gap, share: gap / purchasesValue } : null,
      fixed: canCut(gap) ? { amount: gap, share: gap / base.fixedCosts } : null,
      combined:
        fronts > 1
          ? { fronts, sales: salesFor(share), price: withPrice ? priceFor(share) : null, fixed: withFixed ? share : null }
          : null,
    }
  }

  private resolve(report: DreReport, selection: DreSelection): number[] {
    if (selection.type === 'month') return [selection.index]
    return report.periods.flatMap((p, i) => (p.year === selection.year ? [i] : []))
  }

  private previousOf(report: DreReport, selection: DreSelection, indexes: number[]): number[] | null {
    if (selection.type === 'month') return selection.index > 0 ? [selection.index - 1] : null

    const previous = indexes.map((i) =>
      report.periods.findIndex((p) => p.year === selection.year - 1 && p.month === report.periods[i]!.month),
    )
    return previous.length && previous.every((i) => i >= 0) ? previous : null
  }

  private windowOf(selection: DreSelection, indexes: number[]): number[] {
    if (selection.type === 'year') return indexes
    const start = Math.max(0, selection.index - RECENT_WINDOW + 1)
    return Array.from({ length: selection.index - start + 1 }, (_, i) => start + i)
  }

  private trendFacts(report: DreReport, monthly: DreAnalysis['monthly'], window: number[]) {
    const count = (series: number[] | null, test: (value: number) => boolean) =>
      series ? window.filter((i) => test(series[i]!)).length : null

    const best = window.reduce<number | null>((top, i) => (top === null || monthly.revenue[i]! > monthly.revenue[top]! ? i : top), null)
    const windowRevenue = report.valueOf(report.metric(DreMetric.GrossRevenue), window)
    const margin = report.metric(DreMetric.ContributionMargin)

    return {
      windowIndexes: window,
      bestRevenue:
        window.length > 1 && best !== null && monthly.revenue[best]! > 0 ? { index: best, value: monthly.revenue[best]! } : null,
      positiveEbitdaMonths: count(monthly.ebitda, (v) => v > 0),
      negativeCashMonths: count(monthly.cash, (v) => v < 0),
      averageContributionMargin:
        margin && windowRevenue > 0 ? report.valueOf(margin, window) / windowRevenue : null,
    }
  }

  private expenses(report: DreReport, indexes: number[], revenue: number): DreExpense[] {
    const limit = report.metric(DreMetric.Ebitda) ?? report.metric(DreMetric.NetIncome)
    const limitPosition = limit ? report.lines.indexOf(limit) : report.lines.length

    return report.lines
      .filter((line, position) => line.kind === DreLineKind.Group && position < limitPosition)
      .map((line) => ({ label: line.label, value: -report.valueOf(line, indexes) }))
      .filter((expense) => expense.value > 0)
      .map((expense) => ({ ...expense, share: revenue ? expense.value / revenue : 0 }))
      .sort((a, b) => b.value - a.value)
  }

  private revenueMix(report: DreReport) {
    const revenue = report.metric(DreMetric.GrossRevenue)
    if (!revenue) return []
    return report
      .children(revenue.id)
      .filter((line) => line.values.some((v) => v !== 0))
      .map((line) => ({ label: line.label, values: [...line.values] }))
  }

  profitTargetFor(
    report: DreReport,
    selection: DreSelection,
    sourceIds: readonly string[] | null,
  ): ProfitTargetBase | null {
    const indexes = this.resolve(report, selection)
    return this.profitTargetBase(
      report,
      indexes,
      report.valueOf(report.metric(DreMetric.GrossRevenue), indexes),
      sourceIds,
    )
  }

  private revenueSources(report: DreReport, indexes: number[]): RevenueSource[] {
    const gross = report.metric(DreMetric.GrossRevenue)
    if (!gross) return []
    return report
      .children(gross.id)
      .map((line) => ({ id: line.id, label: line.label, value: report.valueOf(line, indexes) / indexes.length }))
      .filter((source) => source.value > 0)
  }

  private profitTargetBase(
    report: DreReport,
    indexes: number[],
    totalRevenue: number,
    sourceIds: readonly string[] | null = null,
  ): ProfitTargetBase | null {
    const margin = report.metric(DreMetric.ContributionMargin)
    const operating = report.metric(DreMetric.OperatingExpenses)
    const months = indexes.length
    const monthly = (line: DreLine) => report.valueOf(line, indexes) / months
    const grossRevenue = totalRevenue / months
    const sources = sourceIds ? this.revenueSources(report, indexes).filter((s) => sourceIds.includes(s.id)) : null
    const revenue = sources ? sum(sources.map((source) => source.value)) : grossRevenue
    if (!margin || !operating || revenue <= 0) return null

    const excludedRevenue = grossRevenue - revenue
    const contribution = monthly(margin) - excludedRevenue
    const fixedCosts = -monthly(operating)

    const linesBetween = (from: DreLine | undefined, to: DreLine | undefined) => {
      const start = from ? report.lines.indexOf(from) : -1
      const end = to ? report.lines.indexOf(to) : -1
      return report.lines
        .slice(start + 1, end)
        .filter((line) => line.parentId === null && line.kind !== DreLineKind.Result && line.kind !== DreLineKind.Balance)
        .map((line) => ({ line, value: monthly(line) }))
        .filter(({ value }) => value !== 0)
    }

    const salesTaxes = report.metric(DreMetric.SalesTaxes)
    const kindOf = (line: DreLine): VariableCostKind =>
      line === salesTaxes ? 'taxes' : normalizeText(line.label).startsWith('CUSTO') ? 'purchases' : 'expenses'

    const lastResult = report.metric(DreMetric.NetIncome) ?? report.metric(DreMetric.Ebitda)

    return {
      months,
      revenue,
      revenueLabel: sources ? sources.map((source) => source.label).join(' + ') : null,
      excludedRevenue,
      profit: contribution - fixedCosts,
      contributionRatio: contribution / revenue,
      fixedCosts,
      variableLines: linesBetween(report.metric(DreMetric.GrossRevenue), margin).map(({ line, value }) => ({
        label: line.label,
        value: -value,
        kind: kindOf(line),
        ratio: -value / revenue,
      })),
      excludedLines: lastResult
        ? linesBetween(margin, lastResult)
            .filter(({ line }) => line !== operating)
            .map(({ line, value }) => ({ label: line.label, value }))
        : [],
      fixedGroups: report
        .children(operating.id)
        .map((line) => ({ label: line.label, value: -monthly(line) }))
        .filter((line) => line.value > 0)
        .sort((a, b) => b.value - a.value),
    }
  }

  private breakEven(base: ProfitTargetBase | null) {
    if (!base || base.contributionRatio <= 0 || base.fixedCosts <= 0) return null
    return { revenue: (base.fixedCosts / base.contributionRatio) * base.months, actual: base.revenue * base.months }
  }
}
