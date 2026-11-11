import { readDebts, type DebtSchedule } from '@/domain/debts'
import { cellKey, type RawTable } from '@/domain/ingestion'
import { readStock, type Stock } from '@/domain/stock'
import {
  comparePeriods,
  detectNumberConvention,
  DomainError,
  normalizeText,
  parseNumber,
  periodKey,
  sum,
  type Period,
} from '@/domain/shared'
import {
  basisKey,
  categoryKey,
  DEFAULT_BASIS,
  DreRegime,
  effectiveBasis,
  inUnit,
  periodInBasis,
  periodInRegime,
  readSheetBasis,
  type DreBasis,
} from './DreBasis'
import { parseLineFormula, type LineRecipe } from './DreFormula'
import { BOATLUX_LAYOUT, DRE_LAYOUTS, segmentOf, type DreLayout, type DreSegment } from './DreLayout'
import { readLedger, type LedgerEntry } from './Ledger'

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
  OpeningCash: 'openingCash',
  EndingCash: 'endingCash',
} as const

export type DreMetric = (typeof DreMetric)[keyof typeof DreMetric]

const METRIC_LABELS: Record<DreMetric, string[]> = {
  grossRevenue: ['RECEITA OPERACIONAL BRUTA'],
  salesTaxes: ['IMPOSTOS SOBRE VENDA'],
  grossProfit: ['LUCRO OPERACIONAL BRUTO'],
  contributionMargin: ['MARGEM DE CONTRIBUICAO'],
  operatingExpenses: ['DESPESAS OPERACIONAIS'],
  ebitda: ['RESULTADO LIQUIDO (EBITDA)'],
  netIncome: ['RESULTADO LIQUIDO'],
  openingCash: ['SALDO INICIAL'],
  endingCash: ['SALDO FINAL'],
}

const OPENING_LABEL = 'SALDO INICIAL'
const CLOSING_LABEL = 'SALDO FINAL'

const END_OF_TIME = new Date(9999, 0, 1)

/** Por que um lançamento do fluxo de caixa não entra na DRE. */
export type OutsideReason = 'no-category' | 'unknown-category' | 'no-unit' | 'no-issue-date'

export interface OutsideGroup {
  readonly reason: OutsideReason
  /** A categoria (ou, sem ela, a classificação) dos lançamentos. */
  readonly label: string
  readonly count: number
  readonly total: number
}

/**
 * A DRE com todos os meses do cabeçalho e a receita de cada linha em cada mês, para recalcular
 * os valores a partir do fluxo de caixa em outro regime ou unidade.
 */
interface DreModel {
  readonly periods: readonly Period[]
  readonly lines: readonly DreLine[]
  readonly recipes: ReadonlyMap<string, readonly LineRecipe[]>
  readonly lineAtRow: ReadonlyMap<number, string>
  readonly selectorRows: readonly string[][]
  readonly asOf: Date
}

interface DreReportInit {
  readonly name: string
  readonly periods: readonly Period[]
  readonly lines: readonly DreLine[]
  readonly ignoredPeriods?: readonly Period[]
  readonly ledger?: readonly LedgerEntry[]
  readonly basis?: DreBasis
  readonly model?: DreModel | null
  readonly debts?: DebtSchedule | null
  readonly stock?: Stock | null
  readonly views?: Map<string, DreReport>
  readonly layout?: DreLayout
}

export class DreReport {
  readonly name: string
  readonly periods: readonly Period[]
  readonly lines: readonly DreLine[]
  /** Meses com movimento que ainda não terminaram (mês atual e projeções), fora da análise. */
  readonly ignoredPeriods: readonly Period[]
  readonly ledger: readonly LedgerEntry[]
  /** Regime e unidade usados nos valores desta DRE. */
  readonly basis: DreBasis
  /** Valores do filtro que aparecem no fluxo de caixa: unidades (Repasse, Comercial...) ou bancos, conforme o modelo. */
  readonly units: readonly string[]
  /** O modelo da planilha: de qual operação é e por onde a DRE é filtrada. */
  readonly layout: DreLayout
  readonly debts: DebtSchedule | null
  readonly stock: Stock | null
  private readonly model: DreModel | null
  private readonly views: Map<string, DreReport>
  private readonly metrics: ReadonlyMap<DreMetric, DreLine>
  private readonly ambiguousLabels: ReadonlySet<string>
  /** As contas que a planilha soma do fluxo de caixa (SOMASES pela categoria). */
  private readonly accountKeys: ReadonlySet<string>

  private constructor(init: DreReportInit) {
    this.name = init.name
    this.periods = init.periods
    this.lines = init.lines
    this.ignoredPeriods = init.ignoredPeriods ?? []
    this.ledger = init.ledger ?? []
    this.basis = init.basis ?? DEFAULT_BASIS
    this.model = init.model ?? null
    this.debts = init.debts ?? null
    this.stock = init.stock ?? null
    this.views = init.views ?? new Map()
    this.layout = init.layout ?? BOATLUX_LAYOUT
    this.units = uniqueUnits(this.ledger, this.layout.segment)
    this.metrics = matchMetrics(this.lines)
    this.ambiguousLabels = repeatedLabels(this.lines.filter((line) => this.accountsOf(line)[0] === line))
    this.accountKeys = ledgerAccounts(this.model)
  }

  /**
   * Monta a DRE de uma planilha de fechamento, reconhecendo o modelo pela aba: a "DRE Unidades" da Boatlux
   * (filtro por unidade) ou a "DRE Geral" da RS Náutica (filtro por banco). Os valores são recalculados a
   * partir do "Fluxo de Caixa" no regime e no filtro escolhidos na planilha; dívidas e estoque vêm das abas próprias.
   */
  static fromWorkbook(tables: readonly RawTable[], { name, asOf = new Date() }: { name: string; asOf?: Date }): DreReport {
    const candidates = DRE_LAYOUTS.flatMap((layout) => {
      const sheet = tables.find((table) => normalizeText(table.sheet).includes(normalizeText(layout.sheet)))
      return sheet ? [{ layout, sheet, report: DreReport.fromTable(sheet, asOf) }] : []
    })
    if (!candidates.length) {
      throw new DomainError(
        `Não encontramos a aba da DRE nesta planilha: ${DRE_LAYOUTS.map((l) => `"${l.sheet}" (${l.company})`).join(' ou ')}.`,
      )
    }

    // A primeira com receita; a RS tem uma "DRE Unidades" zerada, que não conta.
    const hasRevenue = (report: DreReport) => !!report.metric(DreMetric.GrossRevenue)?.values.some((value) => value !== 0)
    const chosen = candidates.find((c) => c.report && hasRevenue(c.report)) ?? candidates.find((c) => c.report)
    if (!chosen) {
      const { sheet, layout } = candidates[0]!
      if (DreReport.fromTable(sheet, END_OF_TIME)) {
        throw new DomainError('A DRE só tem meses que ainda não terminaram. Os meses entram na análise depois de encerrados.')
      }
      throw new DomainError(
        `A aba "${layout.sheet}" precisa ter a linha dos meses (1 a 12), a dos anos logo abaixo e a linha "Receita operacional bruta".`,
      )
    }

    const { layout, sheet } = chosen
    const rest = tables.filter((table) => table !== sheet)
    const complete = chosen.report!.with({
      name,
      layout,
      ledger: rest.map(readLedger).find(Boolean) ?? [],
      debts: rest.map((table) => readDebts(table, asOf)).find(Boolean) ?? null,
      stock: rest.map(readStock).find(Boolean) ?? null,
    })
    if (!complete.canChangeBasis) return complete
    return complete.withBasis(readSheetBasis(complete.model!.selectorRows, complete.units) ?? DEFAULT_BASIS)
  }

  /** Lê a estrutura e os valores de uma aba de DRE, só com os meses já encerrados. */
  static fromTable(table: RawTable, asOf: Date = new Date()): DreReport | null {
    const header = findPeriodHeader(table.rows)
    if (!header) return null

    const firstDataRow = header.rowIndex + 2
    const dataRows = table.rows.slice(firstDataRow)
    const labelColumn = findLabelColumn(dataRows, header.columns[0]!)
    const convention = detectNumberConvention(dataRows.flatMap((row) => header.columns.map((col) => row[col] ?? '')))
    const entries = dataRows.map((row, i) => ({
      row: firstDataRow + i,
      label: (row[labelColumn] ?? '').trim(),
      values: header.columns.map((col) => {
        const value = parseNumber(row[col] ?? '', convention)
        return Number.isFinite(value) ? value : 0
      }),
      filled: header.columns.map((col) => (row[col] ?? '').trim() !== ''),
    }))

    const { lines, rowOf } = classifyLines(entries)
    const window = closedWindow(lines, header.periods, asOf)
    if (!window) return null

    const report = new DreReport({
      name: table.sheet.trim(),
      ...window,
      model: buildModel(table, header, lines, rowOf, entries, asOf),
    })
    return report.metric(DreMetric.GrossRevenue) ? report : null
  }

  /** Se dá para trocar o regime ou a unidade: a DRE tem as fórmulas da planilha e há lançamentos. */
  get canChangeBasis(): boolean {
    return this.ledger.length > 0 && this.accountKeys.size > 0
  }

  /**
   * Se a DRE mostra um saldo de caixa: precisa da linha "Saldo inicial" (a DRE Unidades não tem; lá o
   * "Saldo final" é o resultado do mês), do regime de caixa (na competência, o saldo inicial fica zerado)
   * e de todas as unidades (os lançamentos de saldo inicial são da empresa toda, sem unidade).
   */
  get hasCashBalance(): boolean {
    // Na RS, o saldo inicial é lançado por banco: dá para ver o saldo de um banco só.
    const wholeCompany = this.basis.unit === null || this.layout.segment.kind === 'bank'
    return this.basis.regime === DreRegime.Cash && wholeCompany && !!this.metric(DreMetric.OpeningCash)
  }

  /**
   * Linhas com valor digitado (ou fórmula desconhecida): mantêm o valor da planilha em qualquer regime,
   * então não acompanham a troca de regime ou de unidade. Só contam os meses desta DRE (projeções digitadas
   * em meses futuros não aparecem na análise).
   */
  get staticLines(): readonly string[] {
    const model = this.model
    if (!model || !this.canChangeBasis) return []
    const shown = new Set(this.periods.map(periodKey))
    const months = model.periods.flatMap((period, i) => (shown.has(periodKey(period)) ? [i] : []))
    return model.lines
      .filter((line) => {
        const recipes = model.recipes.get(line.id) ?? []
        return months.some((i) => recipes[i]?.type === 'fixed' && (line.values[i] ?? 0) !== 0)
      })
      .map((line) => line.label)
  }

  /** A mesma DRE recalculada a partir do fluxo de caixa no regime e na unidade escolhidos. */
  withBasis(requested: DreBasis): DreReport {
    if (!this.canChangeBasis || !this.model) return this
    const basis = effectiveBasis(requested, this.segment)
    const key = basisKey(basis)
    const cached = this.views.get(key)
    if (cached) return cached

    const model = this.model
    const lines = recalculate(model, this.ledger, basis, this.segment)
    // Sem movimento neste regime ou unidade: os mesmos meses da planilha, zerados.
    const window = closedWindow(lines, model.periods, model.asOf) ?? closedWindow(lines, model.periods, model.asOf, model.lines)!
    const view = new DreReport({ ...this.init(), ...window, basis })
    this.views.set(key, view)
    return view
  }

  /**
   * Lançamentos do período que ficam fora da DRE, agrupados pelo motivo: sem categoria (a classificação
   * não está na aba Lista), com uma categoria que não é conta da DRE, sem unidade (fora da DRE de qualquer
   * unidade) ou, na competência, sem data de emissão. Lançamentos de saldo inicial não são resultado e ficam de fora.
   */
  outsideEntries(periodIndexes: readonly number[]): OutsideGroup[] {
    if (!this.canChangeBasis) return []
    const periods = new Set(periodIndexes.flatMap((i) => (this.periods[i] ? [periodKey(this.periods[i]!)] : [])))
    const groups = new Map<string, { reason: OutsideReason; label: string; count: number; total: number }>()
    const add = (reason: OutsideReason, label: string, value: number) => {
      const key = `${reason}|${label}`
      const group = groups.get(key) ?? { reason, label, count: 0, total: 0 }
      group.count++
      group.total += value
      groups.set(key, group)
    }

    const inPeriods = (period: Period | null) => !!period && periods.has(periodKey(period))
    const accrual = this.basis.regime === DreRegime.Accrual

    for (const entry of this.ledger) {
      if (isOpeningEntry(entry)) continue
      // Lançamento de outra unidade: é da DRE dela, não está "fora".
      const unitless = !segmentOf(entry, this.segment)
      if (!unitless && !inUnit(entry, this.basis, this.segment)) continue

      // Na competência, quem não tem data de emissão é situado pelo mês do pagamento. Na RS não: caixa e
      // competência são lançamentos separados, e os de caixa não têm mês de competência de propósito.
      const month = periodInRegime(entry, this.basis.regime)
      if (!inPeriods(month ?? (accrual && this.segment.inAccrual ? entry.cashPeriod : null))) continue

      // Da causa mais de raiz para a mais simples: corrigir só a de baixo não traz o lançamento para a DRE.
      if (!entry.category) add('no-category', entry.account || 'Sem classificação', entry.value)
      else if (!this.accountKeys.has(categoryKey(entry.category))) add('unknown-category', entry.category, entry.value)
      else if (unitless && this.basis.unit !== null) add('no-unit', entry.category, entry.value)
      else if (!month) add('no-issue-date', 'Sem data de emissão', entry.value)
    }
    return [...groups.values()]
      .map((group) => ({ ...group, total: cents(group.total) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }

  accountsOf(line: DreLine): DreLine[] {
    if (line.kind === DreLineKind.Account) return [line]
    if (line.kind === DreLineKind.Result || line.kind === DreLineKind.Balance) return []
    const children = this.children(line.id)
    return children.length ? children.flatMap((child) => this.accountsOf(child)) : [line]
  }

  /** Se dá para abrir os lançamentos de uma linha: há fluxo de caixa e nenhuma conta repete o nome. */
  isTraceable(line: DreLine): boolean {
    const accounts = this.accountsOf(line)
    return (
      this.ledger.length > 0 &&
      accounts.length > 0 &&
      accounts.every((account) => !this.ambiguousLabels.has(categoryKey(account.label)))
    )
  }

  entriesOf(line: DreLine, periodIndex: number): LedgerEntry[] {
    const period = this.periods[periodIndex]
    if (!period) return []
    const labels = new Set(this.accountsOf(line).map((account) => categoryKey(account.label)))
    return this.ledger.filter((entry) => {
      const entryPeriod = periodInBasis(entry, this.basis, this.segment)
      return !!entryPeriod && comparePeriods(entryPeriod, period) === 0 && labels.has(categoryKey(entry.category))
    })
  }

  /** Por onde a DRE é filtrada neste modelo: unidade ou banco. */
  get segment(): DreSegment {
    return this.layout.segment
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

  private init(): DreReportInit {
    return {
      name: this.name,
      periods: this.periods,
      lines: this.lines,
      ignoredPeriods: this.ignoredPeriods,
      ledger: this.ledger,
      basis: this.basis,
      model: this.model,
      debts: this.debts,
      stock: this.stock,
      views: this.views,
      layout: this.layout,
    }
  }

  private with(changes: Partial<DreReportInit>): DreReport {
    return new DreReport({ ...this.init(), views: new Map(), ...changes })
  }
}

interface PeriodHeader {
  rowIndex: number
  columns: number[]
  periods: Period[]
}

const isMonthCell = (value: string | undefined) => /^\d{1,2}$/.test(value?.trim() ?? '') && Number(value) >= 1 && Number(value) <= 12
const isYearCell = (value: string | undefined) => /^(19|20)\d{2}$/.test(value?.trim() ?? '')

/**
 * A linha dos meses (1 a 12) com a dos anos logo abaixo. Meses repetidos ficam com a primeira coluna; a coluna
 * "Acumulado" (mês e ano zerados) não entra.
 */
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

/** Os meses encerrados com movimento; os seguintes (mês em andamento, projeções) ficam registrados como ignorados. */
function closedWindow(
  lines: readonly DreLine[],
  periods: readonly Period[],
  asOf: Date,
  activityFrom: readonly DreLine[] = lines,
): { periods: Period[]; lines: DreLine[]; ignoredPeriods: Period[] } | null {
  const range = activeRange(activityFrom, periods.length)
  if (!range || !lines.length) return null

  const [start, end] = range
  const firstOpen = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 }
  const closed = periods.map((period) => comparePeriods(period, firstOpen) < 0)
  const last = closed.lastIndexOf(true, end)
  if (last < start) return null

  return {
    periods: periods.slice(start, last + 1),
    lines: lines.map((line) => ({ ...line, values: line.values.slice(start, last + 1) })),
    ignoredPeriods: periods.slice(last + 1, end + 1),
  }
}

function buildModel(
  table: RawTable,
  header: PeriodHeader,
  lines: DreLine[],
  rowOf: ReadonlyMap<string, number>,
  entries: readonly { row: number; filled: boolean[] }[],
  asOf: Date,
): DreModel | null {
  const formulas = table.formulas
  if (!formulas?.size) return null
  const filled = new Map(entries.map((entry) => [entry.row, entry.filled]))
  const recipes = new Map<string, LineRecipe[]>()
  const lineAtRow = new Map<number, string>()
  for (const line of lines) {
    const row = rowOf.get(line.id)!
    lineAtRow.set(row, line.id)
    recipes.set(
      line.id,
      header.columns.map((column, i) => parseLineFormula(formulas.get(cellKey(row, column)), column, filled.get(row)?.[i] ?? false)),
    )
  }
  return { periods: header.periods, lines, recipes, lineAtRow, selectorRows: table.rows.slice(0, header.rowIndex), asOf }
}

const cents = (value: number) => Math.round(value * 100) / 100

/** Unidades (ou bancos) do fluxo de caixa, sem repetir variações de maiúsculas e espaços ("Repasse" e "REPASSE "). */
function uniqueUnits(ledger: readonly LedgerEntry[], segment: DreSegment): string[] {
  const byKey = new Map<string, string>()
  for (const entry of ledger) {
    const unit = segmentOf(entry, segment)
    if (unit && !byKey.has(categoryKey(unit))) byKey.set(categoryKey(unit), unit.trim())
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** O lançamento de "Saldo inicial" registra o caixa do começo do mês, não resultado. */
const isOpeningEntry = (entry: LedgerEntry) => normalizeText(entry.category) === OPENING_LABEL

function ledgerAccounts(model: DreModel | null): Set<string> {
  if (!model) return new Set()
  const fromLedger = model.lines.filter((line) => model.recipes.get(line.id)?.some((recipe) => recipe.type === 'ledger'))
  return new Set(fromLedger.map((line) => categoryKey(line.label)))
}

/**
 * Refaz as contas da planilha: cada conta soma o fluxo de caixa pela categoria (como o SOMASES) e os totais
 * e resultados seguem as fórmulas de cada mês. Os valores ficam em centavos, como o Excel mostra.
 */
function recalculate(model: DreModel, ledger: readonly LedgerEntry[], basis: DreBasis, segment: DreSegment): DreLine[] {
  const indexOf = new Map(model.periods.map((period, i) => [periodKey(period), i]))
  const ledgerTotals = new Map<string, number[]>()
  for (const entry of ledger) {
    const period = periodInBasis(entry, basis, segment)
    const index = period ? indexOf.get(periodKey(period)) : undefined
    if (index === undefined || !entry.category) continue
    const key = categoryKey(entry.category)
    const totals = ledgerTotals.get(key) ?? Array<number>(model.periods.length).fill(0)
    totals[index]! += entry.value
    ledgerTotals.set(key, totals)
  }

  const zeros = () => Array<number>(model.periods.length).fill(0)
  const byId = new Map(model.lines.map((line) => [line.id, line]))
  const computed = new Map<string, number[]>()
  const visiting = new Set<string>()

  const valuesOf = (id: string): number[] => {
    const known = computed.get(id)
    if (known) return known
    // Referência circular na planilha: a linha fica zerada em vez de travar o cálculo.
    if (visiting.has(id)) return zeros()
    visiting.add(id)
    const line = byId.get(id)!
    const recipes = model.recipes.get(id) ?? []
    const fromLedger = ledgerTotals.get(categoryKey(line.label))
    const values = model.periods.map((_, i) => {
      const recipe = recipes[i] ?? { type: 'fixed' }
      if (recipe.type === 'ledger') return cents(fromLedger?.[i] ?? 0)
      if (recipe.type === 'blank') return 0
      if (recipe.type === 'fixed') return line.values[i] ?? 0
      return cents(recipe.terms.reduce((total, term) => total + term.sign * (valuesAtRow(term.row)[i] ?? 0), recipe.constant))
    })
    visiting.delete(id)
    computed.set(id, values)
    return values
  }
  const valuesAtRow = (row: number) => {
    const id = model.lineAtRow.get(row)
    return id ? valuesOf(id) : zeros()
  }

  return model.lines.map((line) => ({ ...line, values: valuesOf(line.id) }))
}

const isUpperLabel = (label: string) => /\p{L}/u.test(label) && label === label.toUpperCase()

/**
 * "Saldo inicial" vale o primeiro mês do período e o "Saldo final" de caixa o último, mas só quando a DRE tem
 * saldo inicial. Na DRE Unidades, "Saldo final" é o resultado do mês e soma como as outras linhas.
 */
function aggregationOf(label: string, row: number, closingRow: number | null): DreAggregation {
  const normalized = normalizeText(label)
  if (closingRow === null) return 'sum'
  if (normalized === OPENING_LABEL) return 'first'
  if (row === closingRow) return 'last'
  return 'sum'
}

/**
 * A linha do saldo final de caixa: o "Saldo final" logo depois do "Saldo inicial". Na DRE Geral da RS há também
 * um "SALDO FINAL" antes dele, que é o resultado do mês. Sem saldo inicial, não há saldo de caixa.
 */
function closingCashRow(entries: readonly Entry[]): number | null {
  const opening = entries.findIndex((entry) => normalizeText(entry.label) === OPENING_LABEL)
  if (opening === -1) return null
  const isClosing = (entry: Entry) => normalizeText(entry.label) === CLOSING_LABEL
  return (entries.slice(opening).find(isClosing) ?? entries.find(isClosing))?.row ?? null
}

const isSumOf = (parent: number[], children: number[][]) =>
  parent.every((value, i) => {
    const total = children.reduce((acc, child) => acc + (child[i] ?? 0), 0)
    return Math.abs(value - total) <= 0.5 + Math.abs(value) * 1e-6
  })

const isSumWhereFilled = (total: number[], parts: number[][]) => {
  const filled = total.flatMap((value, i) => (value !== 0 ? [i] : []))
  return filled.length > 0 && filled.every((i) => isSumOf([total[i]!], parts.map((part) => [part[i] ?? 0])))
}

interface Entry {
  row: number
  label: string
  values: number[]
}

/**
 * Reconstrói a hierarquia pelos blocos separados por linha em branco: bloco de uma linha é resultado
 * (ou saldo), cabeçalho igual à soma das linhas abaixo é grupo, cabeçalho seguido de outro título em
 * maiúsculas é seção.
 */
function classifyLines(entries: Entry[]): { lines: DreLine[]; rowOf: Map<string, number> } {
  const blocks: Entry[][] = [[]]
  for (const entry of entries) {
    if (entry.label) blocks.at(-1)!.push(entry)
    else if (blocks.at(-1)!.length) blocks.push([])
  }

  const lines: DreLine[] = []
  const rowOf = new Map<string, number>()
  const closingRow = closingCashRow(entries)
  let section: string | null = null
  const add = (entry: Entry, kind: DreLineKind, parentId: string | null) => {
    const id = `l${lines.length}`
    lines.push({ id, label: entry.label, kind, parentId, aggregation: aggregationOf(entry.label, entry.row, closingRow), values: entry.values })
    rowOf.set(id, entry.row)
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

    // Quadro com o total na última linha, chamada "Saldo" ou "Total" (ex.: o de securitização no topo da DRE
    // Unidades): linhas simples. O total pode estar vazio em alguns meses; compara onde está preenchido.
    const last = block.at(-1)!
    const isTotalLabel = /^(SALDO|TOTAL)\b/.test(normalizeText(last.label))
    if (rest.length > 1 && isTotalLabel && isSumWhereFilled(last.values, block.slice(0, -1).map((r) => r.values))) {
      section = null
      block.forEach((entry) => add(entry, DreLineKind.Balance, null))
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
  return { lines, rowOf }
}

function activeRange(lines: readonly DreLine[], periodCount: number): [number, number] | null {
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
    const label = categoryKey(line.label)
    if (seen.has(label)) repeated.add(label)
    seen.add(label)
  }
  return repeated
}

function matchMetrics(lines: readonly DreLine[]): Map<DreMetric, DreLine> {
  const metrics = new Map<DreMetric, DreLine>()
  for (const [metric, labels] of Object.entries(METRIC_LABELS) as [DreMetric, string[]][]) {
    const matches = lines.filter((l) => labels.includes(normalizeText(l.label)))
    // Com dois "Saldo final" (RS), o de caixa é o que vale o último mês.
    const line = metric === DreMetric.EndingCash ? (matches.find((l) => l.aggregation === 'last') ?? matches[0]) : matches[0]
    if (line) metrics.set(metric, line)
  }
  return metrics
}
