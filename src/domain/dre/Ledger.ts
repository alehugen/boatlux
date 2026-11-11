import { findTableHeader, type RawTable } from '@/domain/ingestion'
import { normalizeText, type Period } from '@/domain/shared'

/** Um lançamento da aba "Fluxo de Caixa". */
export interface LedgerEntry {
  /** Data de pagamento (ISO), ou vazio se ainda não foi pago. */
  readonly date: string
  /** Data de emissão (ISO), ou vazio. */
  readonly issueDate: string
  readonly description: string
  /** Coluna "Categoria": é por ela que a DRE soma os lançamentos. Vazia quando a classificação não está na aba Lista. */
  readonly category: string
  /** Coluna "Classificação C.A", de onde a planilha tira a categoria. */
  readonly account: string
  readonly unit: string
  readonly bank: string
  readonly value: number
  /** Mês de caixa (mês e ano do pagamento). */
  readonly cashPeriod: Period | null
  /** Mês de competência (mês e ano da emissão). */
  readonly accrualPeriod: Period | null
}

const COLUMN_ALIASES = {
  // Na RS, a coluna da categoria se chama "Classificações".
  category: ['CATEGORIA', 'CLASSIFICACOES'],
  account: ['CLASSIFICACAOCA', 'CLASSIFICACAO'],
  signedValue: ['VALORDEMOVIMENTO'],
  value: ['VALOR'],
  movement: ['MOVIMENTACAO'],
  paidAt: ['DATAPAGTO', 'DATADEPAGAMENTO'],
  issuedAt: ['DATADEEMISSAO'],
  cashMonth: ['MESCX'],
  cashYear: ['ANOCX'],
  accrualMonth: ['MESCOMP'],
  accrualYear: ['ANOCOMP'],
  description: ['HISTORICO'],
  unit: ['UNIDADE'],
  bank: ['BANCO'],
} as const

type Column = keyof typeof COLUMN_ALIASES

const isMonth = (month: number) => Number.isInteger(month) && month >= 1 && month <= 12
const isYear = (year: number) => Number.isInteger(year) && year >= 1900 && year <= 2999
const isDay = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31
const pad = (value: number) => String(value).padStart(2, '0')

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/
const BR_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/

function parseDate(text: string): { iso: string; period: Period } | null {
  const iso = ISO_DATE.exec(text.trim())
  const br = iso ? null : BR_DATE.exec(text.trim())
  const parts = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : null
  if (!parts) return null
  const [rawYear, month, day] = parts.map(Number) as [number, number, number]
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  if (!isYear(year) || !isMonth(month) || !isDay(day)) return null
  return { iso: `${year}-${pad(month)}-${pad(day)}`, period: { year, month } }
}

/**
 * Lê a aba "Fluxo de Caixa". Fica cada linha com valor e com data de pagamento ou de emissão,
 * inclusive as sem categoria, para mostrar o que não entra na DRE.
 */
export function readLedger(table: RawTable): LedgerEntry[] | null {
  const header = findTableHeader(table.rows, COLUMN_ALIASES, ['category', 'value', 'paidAt'])
  if (!header) return null
  const has = (...names: Column[]) => names.every((name) => header.columns[name] !== undefined)

  /** "Valor de movimento" já vem com sinal; sem ela, a movimentação diz se é entrada ou saída. */
  const signed = (row: readonly string[]) => {
    if (has('signedValue')) return header.number(row, 'signedValue')
    const value = header.number(row, 'value')
    const movement = normalizeText(header.text(row, 'movement'))
    if (movement.startsWith('SAIDA')) return -Math.abs(value)
    if (movement.startsWith('ENTRADA')) return Math.abs(value)
    return value
  }

  /** Mês e ano das colunas da planilha ("Mês Cx.", "Mês Comp."); sem elas, o mês da data. */
  const periodOf = (row: readonly string[], month: Column, year: Column, fallback: Period | null) => {
    if (!has(month, year)) return fallback
    const m = header.number(row, month)
    const y = header.number(row, year)
    return isMonth(m) && isYear(y) ? { year: y, month: m } : fallback
  }

  const entries = table.rows.slice(header.rowIndex + 1).flatMap((row): LedgerEntry[] => {
    const value = signed(row)
    if (!value) return []
    const paid = parseDate(header.text(row, 'paidAt'))
    const issued = parseDate(header.text(row, 'issuedAt'))
    const cashPeriod = paid ? periodOf(row, 'cashMonth', 'cashYear', paid.period) : null
    const accrualPeriod = periodOf(row, 'accrualMonth', 'accrualYear', issued?.period ?? null)
    if (!cashPeriod && !accrualPeriod) return []
    return [
      {
        date: paid?.iso ?? '',
        issueDate: issued?.iso ?? '',
        description: header.text(row, 'description'),
        category: header.text(row, 'category'),
        account: header.text(row, 'account'),
        unit: header.text(row, 'unit'),
        bank: header.text(row, 'bank'),
        value,
        cashPeriod,
        accrualPeriod,
      },
    ]
  })

  return entries.length ? entries : null
}
