import type { RawTable } from '@/domain/ingestion'
import {
  comparePeriods,
  detectNumberConvention,
  normalizeText,
  parseNumber,
  sum,
  type NumberConvention,
  type Period,
} from '@/domain/shared'

export interface Debt {
  readonly label: string
  /** Saldo devedor: o da coluna "Saldo" da planilha ou, sem ela, as parcelas do mês atual em diante. */
  readonly balance: number
  /** Parcela de cada mês do cronograma, na ordem de `DebtSchedule.periods`. */
  readonly installments: readonly number[]
}

export interface DebtSchedule {
  readonly periods: readonly Period[]
  readonly debts: readonly Debt[]
  /** Data da última atualização informada na planilha (ISO), se houver. */
  readonly updatedAt: string | null
  /** Se o saldo veio da própria planilha (coluna "Saldo"). */
  readonly balanceFromSheet: boolean
}

const SHEET_NAMES = ['DIVIDA', 'EMPRESTIMO', 'FINANCIAMENTO']
const HEADER_SEARCH_ROWS = 10
const MIN_MONTHS = 3

const MONTH_YEAR = /^(\d{1,2})\/(\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-\d{2}$/
const BR_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/

function periodOfHeader(text: string): Period | null {
  const monthYear = MONTH_YEAR.exec(text.trim())
  const iso = monthYear ? null : ISO_DATE.exec(text.trim())
  const [month, year] = monthYear ? [Number(monthYear[1]), Number(monthYear[2])] : iso ? [Number(iso[2]), Number(iso[1])] : [0, 0]
  return month >= 1 && month <= 12 && year >= 1900 ? { year, month } : null
}

function updatedAtOf(rows: readonly string[][], untilRow: number): string | null {
  for (const row of rows.slice(0, untilRow + 1)) {
    for (const cell of row) {
      if (!normalizeText(cell).includes('ATUALIZ')) continue
      const date = BR_DATE.exec(cell)
      if (date) return `${date[3]}-${date[2]!.padStart(2, '0')}-${date[1]!.padStart(2, '0')}`
    }
  }
  return null
}

/** Lê a aba de dívidas: uma linha por dívida, a coluna "Saldo" e uma coluna por mês (mm/aaaa) com a parcela. */
export function readDebts(table: RawTable, asOf: Date = new Date()): DebtSchedule | null {
  if (!SHEET_NAMES.some((name) => normalizeText(table.sheet).includes(name))) return null

  for (let headerRow = 0; headerRow < Math.min(table.rows.length, HEADER_SEARCH_ROWS); headerRow++) {
    const header = table.rows[headerRow]!
    const monthColumns = header.flatMap((cell, column) => {
      const period = periodOfHeader(cell)
      return period ? [{ column, period }] : []
    })
    if (monthColumns.length < MIN_MONTHS) continue

    const balanceColumn = header.findIndex((cell) => normalizeText(cell).startsWith('SALDO'))
    const body = table.rows.slice(headerRow + 1)
    const end = body.findIndex((row) => normalizeText(row[0] ?? '').startsWith('TOTAL'))
    const rows = (end === -1 ? body : body.slice(0, end)).filter((row) => /\p{L}/u.test(row[0] ?? ''))
    const convention = detectNumberConvention(rows.flatMap((row) => monthColumns.map(({ column }) => row[column] ?? '')))

    const periods = monthColumns.map(({ period }) => period)
    const firstOpen = periods.findIndex((period) => comparePeriods(period, { year: asOf.getFullYear(), month: asOf.getMonth() + 1 }) >= 0)
    const debts = rows.flatMap((row): Debt[] => {
      const installments = monthColumns.map(({ column }) => amount(row[column], convention))
      const remaining = firstOpen === -1 ? 0 : sum(installments.slice(firstOpen))
      const balance = balanceColumn === -1 ? remaining : amount(row[balanceColumn], convention)
      if (!balance && installments.every((value) => !value)) return []
      return [{ label: row[0]!.trim(), balance, installments }]
    })
    if (!debts.length) return null

    return { periods, debts, updatedAt: updatedAtOf(table.rows, headerRow), balanceFromSheet: balanceColumn !== -1 }
  }
  return null
}

function amount(text: string | undefined, convention: NumberConvention | undefined): number {
  const value = Math.abs(parseNumber(text ?? '', convention))
  return Number.isFinite(value) ? value : 0
}

export interface DebtStatus {
  readonly label: string
  readonly balance: number
  /** Parcela do mês de referência. */
  readonly installment: number
  /** Mês da última parcela do cronograma, se ainda houver parcelas. */
  readonly payoff: Period | null
}

export interface DebtOverview {
  readonly reference: Period
  readonly balance: number
  readonly installment: number
  readonly payoff: Period | null
  readonly debts: readonly DebtStatus[]
}

/** A situação das dívidas no mês de referência (por padrão, o mês atual). */
export function debtOverview(schedule: DebtSchedule, asOf: Date = new Date()): DebtOverview {
  const reference = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 }
  const current = schedule.periods.findIndex((period) => comparePeriods(period, reference) === 0)
  const debts = schedule.debts
    .map((debt): DebtStatus => {
      const last = debt.installments.reduce((found, value, i) => (value > 0 ? i : found), -1)
      const payoff = last !== -1 && comparePeriods(schedule.periods[last]!, reference) >= 0 ? schedule.periods[last]! : null
      return { label: debt.label, balance: debt.balance, installment: current === -1 ? 0 : (debt.installments[current] ?? 0), payoff }
    })
    .sort((a, b) => b.balance - a.balance)
  const payoffs = debts.flatMap((debt) => (debt.payoff ? [debt.payoff] : []))
  return {
    reference,
    balance: sum(debts.map((debt) => debt.balance)),
    installment: sum(debts.map((debt) => debt.installment)),
    payoff: payoffs.sort(comparePeriods).at(-1) ?? null,
    debts,
  }
}
