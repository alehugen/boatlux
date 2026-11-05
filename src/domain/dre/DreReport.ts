import type { RawTable } from '@/domain/ingestion'
import { readLedger, type LedgerEntry } from './Ledger'
import {
  comparePeriods,
  createIdentifier,
  detectNumberConvention,
  DomainError,
  normalizeText,
  parseNumber,
  periodKey,
  sum,
  type Identifier,
  type Period,
} from '@/domain/shared'

export const DreLineKind = {
  Section: 'section',
  Group: 'group',
  Account: 'account',
  Result: 'result',
  Balance: 'balance',
} as const

export type DreLineKind = (typeof DreLineKind)[keyof typeof DreLineKind]

export type DreAggregation = 'sum' | 'first' | 'last'
export interface DreLine {
  readonly id: string
  readonly label: string
  readonly kind: DreLineKind
  readonly parentId: string | null
  readonly aggregation: DreAggregation
  readonly values: readonly number[]
}

export const DreMetric = {
  GrossRevenue: 'grossRevenue',
  SalesTaxes: 'salesTaxes',
  GrossProfit: 'grossProfit',
  ContributionMargin: 'contributionMargin',
  OperatingExpenses: 'operatingExpenses',
  Ebitda: 'ebitda',
  NetIncome: 'netIncome',
  EndingCash: 'endingCash',
} as const

export type DreMetric = (typeof DreMetric)[keyof typeof DreMetric]

const METRIC_LABELS: Record<DreMetric, string[]> = {
  grossRevenue: ['RECEITA OPERACIONAL BRUTA', 'RECEITA BRUTA'],
  salesTaxes: ['IMPOSTOS SOBRE VENDA', 'IMPOSTOS SOBRE VENDAS', 'DEDUCOES DA RECEITA BRUTA'],
  grossProfit: ['LUCRO OPERACIONAL BRUTO', 'LUCRO BRUTO'],
  contributionMargin: ['MARGEM DE CONTRIBUICAO'],
  operatingExpenses: ['DESPESAS OPERACIONAIS'],
  ebitda: ['RESULTADO LIQUIDO (EBITDA)', 'EBITDA'],
  netIncome: ['RESULTADO LIQUIDO', 'LUCRO LIQUIDO', 'RESULTADO LIQUIDO DO EXERCICIO'],
  endingCash: ['SALDO FINAL'],
}

const PREFERRED_SHEET = 'DRE GERAL'
const END_OF_TIME = new Date(9999, 0, 1)

export class DreReport {
  readonly kind = 'dre' as const
  readonly id: Identifier = createIdentifier()
  readonly importedAt = new Date()
  readonly name: string
  readonly periods: readonly Period[]
  readonly lines: readonly DreLine[]
  readonly ignoredPeriods: readonly Period[]
  readonly ledger: readonly LedgerEntry[]
  private readonly metrics: ReadonlyMap<DreMetric, DreLine>
  private readonly ambiguousLabels: ReadonlySet<string>

  private constructor(
    name: string,
    periods: Period[],
    lines: DreLine[],
    ignoredPeriods: Period[] = [],
    ledger: LedgerEntry[] = [],
  ) {
    this.name = name
    this.periods = periods
    this.lines = lines
    this.ignoredPeriods = ignoredPeriods
    this.ledger = ledger
    this.metrics = matchMetrics(lines)
    this.ambiguousLabels = repeatedLabels(lines.filter((line) => this.accountsOf(line)[0] === line))
  }

  static fromTables(tables: readonly RawTable[], asOf: Date = new Date()): DreReport | null {
    const preferred = tables.filter((t) => normalizeText(t.sheet ?? '').includes(PREFERRED_SHEET))
    const others = tables.filter((t) => !preferred.includes(t))
    for (const table of [...preferred, ...others]) {
      const report = DreReport.fromTable(table, asOf)
      if (!report) continue
      const ledger = tables.filter((other) => other !== table).map(readLedger).find(Boolean)
      return ledger
        ? new DreReport(report.name, [...report.periods], [...report.lines], [...report.ignoredPeriods], ledger)
        : report
    }
    if (tables.some((table) => DreReport.fromTable(table, END_OF_TIME))) {
      throw new DomainError(
        'A DRE só tem meses que ainda não terminaram. Os meses entram na análise depois de encerrados.',
      )
    }
    return null
  }

  static fromTable(table: RawTable, asOf: Date = new Date()): DreReport | null {
    const header = findPeriodHeader(table.rows)
    if (!header) return null

    const dataRows = table.rows.slice(header.rowIndex + 2)
    const labelColumn = findLabelColumn(dataRows, header.columns[0]!)
    const convention = detectNumberConvention(dataRows.flatMap((row) => header.columns.map((col) => row[col] ?? '')))
    const entries = dataRows.map((row) => ({
      label: (row[labelColumn] ?? '').trim(),
      values: header.columns.map((col) => {
        const value = parseNumber(row[col] ?? '', convention)
        return Number.isFinite(value) ? value : 0
      }),
    }))

    const lines = classifyLines(entries)
    const range = activeRange(lines, header.periods.length)
    if (!range || !lines.length) return null

    const [start, end] = range
    const firstOpen = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 }
    const closed = header.periods.map((period) => comparePeriods(period, firstOpen) < 0)
    const last = closed.lastIndexOf(true, end)
    if (last < start) return null

    const trimmed = lines.map((line) => ({ ...line, values: line.values.slice(start, last + 1) }))
    const ignored = header.periods.slice(last + 1, end + 1)
    const report = new DreReport(table.name, header.periods.slice(start, last + 1), trimmed, ignored)

    return report.metric(DreMetric.GrossRevenue) ? report : null
  }

  accountsOf(line: DreLine): DreLine[] {
    if (line.kind === DreLineKind.Account) return [line]
    if (line.kind === DreLineKind.Result || line.kind === DreLineKind.Balance) return []
    const children = this.children(line.id)
    return children.length ? children.flatMap((child) => this.accountsOf(child)) : [line]
  }

  isTraceable(line: DreLine): boolean {
    const accounts = this.accountsOf(line)
    return (
      this.ledger.length > 0 &&
      accounts.length > 0 &&
      accounts.every((account) => !this.ambiguousLabels.has(normalizeText(account.label)))
    )
  }

  entriesOf(line: DreLine, periodIndex: number): LedgerEntry[] {
    const period = this.periods[periodIndex]
    if (!period) return []
    const labels = new Set(this.accountsOf(line).map((account) => normalizeText(account.label)))
    return this.ledger.filter(
      (entry) =>
        labels.has(normalizeText(entry.classification)) &&
        entry.period.year === period.year &&
        entry.period.month === period.month,
    )
  }

  metric(metric: DreMetric): DreLine | undefined {
    return this.metrics.get(metric)
  }

  children(lineId: string): DreLine[] {
    return this.lines.filter((line) => line.parentId === lineId)
  }

  valueOf(line: DreLine | undefined, periodIndexes: readonly number[]): number {
    if (!line || !periodIndexes.length) return 0
    if (line.aggregation === 'first') return line.values[periodIndexes[0]!] ?? 0
    if (line.aggregation === 'last') return line.values[periodIndexes.at(-1)!] ?? 0
    return sum(periodIndexes.map((i) => line.values[i] ?? 0))
  }
}

interface PeriodHeader {
  rowIndex: number
  columns: number[]
  periods: Period[]
}

const isMonthCell = (value: string | undefined) => /^\d{1,2}$/.test(value?.trim() ?? '') && Number(value) >= 1 && Number(value) <= 12
const isYearCell = (value: string | undefined) => /^(19|20)\d{2}$/.test(value?.trim() ?? '')

function findPeriodHeader(rows: string[][]): PeriodHeader | null {
  let best: PeriodHeader | null = null
  for (let rowIndex = 0; rowIndex < Math.min(rows.length - 1, 30); rowIndex++) {
    const monthRow = rows[rowIndex] ?? []
    const yearRow = rows[rowIndex + 1] ?? []
    const columns: number[] = []
    const periods: Period[] = []
    const seen = new Set<string>()

    monthRow.forEach((cell, col) => {
      if (!isMonthCell(cell) || !isYearCell(yearRow[col])) return
      const period = { year: Number(yearRow[col]), month: Number(cell) }
      if (seen.has(periodKey(period))) return
      seen.add(periodKey(period))
      columns.push(col)
      periods.push(period)
    })

    const order = periods.map((_, i) => i).sort((x, y) => comparePeriods(periods[x]!, periods[y]!))
    if (periods.length > (best?.periods.length ?? 0)) {
      best = { rowIndex, columns: order.map((i) => columns[i]!), periods: order.map((i) => periods[i]!) }
    }
  }
  return best
}

function findLabelColumn(rows: string[][], firstPeriodColumn: number): number {
  let best = 0
  let bestCount = -1
  for (let col = 0; col < firstPeriodColumn; col++) {
    const count = rows.filter((row) => /\p{L}/u.test(row[col] ?? '')).length
    if (count > bestCount) [best, bestCount] = [col, count]
  }
  return best
}

const isUpperLabel = (label: string) => /\p{L}/u.test(label) && label === label.toUpperCase()

function aggregationOf(label: string): DreAggregation {
  const normalized = normalizeText(label)
  if (!normalized.startsWith('SALDO')) return 'sum'
  return normalized.includes('FINAL') ? 'last' : 'first'
}

const isSumOf = (parent: number[], children: number[][]) =>
  parent.every((value, i) => {
    const sum = children.reduce((acc, child) => acc + (child[i] ?? 0), 0)
    return Math.abs(value - sum) <= 0.5 + Math.abs(value) * 1e-6
  })

interface Entry {
  label: string
  values: number[]
}
function classifyLines(entries: Entry[]): DreLine[] {
  const blocks: Entry[][] = [[]]
  for (const entry of entries) {
    if (entry.label) blocks.at(-1)!.push(entry)
    else if (blocks.at(-1)!.length) blocks.push([])
  }

  const lines: DreLine[] = []
  let section: string | null = null
  const add = (entry: Entry, kind: DreLineKind, parentId: string | null) => {
    const id = `l${lines.length}`
    lines.push({ id, label: entry.label, kind, parentId, aggregation: aggregationOf(entry.label), values: entry.values })
    return id
  }

  const processBlock = (block: Entry[]) => {
    const [head, ...rest] = block
    if (!head) return

    if (!rest.length) {
      section = null
      add(head, isUpperLabel(head.label) ? DreLineKind.Result : DreLineKind.Balance, null)
      return
    }

    if (isSumOf(head.values, rest.map((r) => r.values))) {
      const groupId = add(head, DreLineKind.Group, section)
      rest.forEach((entry) => add(entry, DreLineKind.Account, groupId))
      return
    }

    if (isUpperLabel(rest[0]!.label)) {
      section = add(head, DreLineKind.Section, null)
      processBlock(rest)
      return
    }

    section = null
    block.forEach((entry) => add(entry, DreLineKind.Balance, null))
  }

  blocks.forEach(processBlock)
  return lines
}

function activeRange(lines: DreLine[], periodCount: number): [number, number] | null {
  const flows = lines.filter((line) => line.aggregation === 'sum')
  const active = Array.from({ length: periodCount }, (_, i) => flows.some((line) => line.values[i] !== 0))
  const start = active.indexOf(true)
  const end = active.lastIndexOf(true)
  return start === -1 ? null : [start, end]
}

function repeatedLabels(lines: readonly DreLine[]): Set<string> {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const line of lines) {
    const label = normalizeText(line.label)
    if (seen.has(label)) repeated.add(label)
    seen.add(label)
  }
  return repeated
}

function matchMetrics(lines: DreLine[]): Map<DreMetric, DreLine> {
  const metrics = new Map<DreMetric, DreLine>()
  for (const [metric, labels] of Object.entries(METRIC_LABELS) as [DreMetric, string[]][]) {
    const line = lines.find((l) => labels.includes(normalizeText(l.label)))
    if (line) metrics.set(metric, line)
  }
  return metrics
}
