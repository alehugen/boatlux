import { findTableHeader, type RawTable } from '@/domain/ingestion'
import { normalizeText, type Period } from '@/domain/shared'

export interface LedgerEntry {
  readonly date: string
  readonly description: string
  readonly classification: string
  readonly unit: string
  readonly value: number
  readonly period: Period
}

const COLUMN_ALIASES = {
  classification: ['CLASSIFICACAO', 'PLANODECONTAS', 'CONTA'],
  signedValue: ['VALORDEMOVIMENTO', 'VALORMOVIMENTO'],
  value: ['VALOR', 'VALORPAGO', 'VALORTOTAL'],
  movement: ['MOVIMENTACAO', 'TIPO', 'NATUREZA'],
  paidAt: ['DATAPAGTO', 'DATAPAGAMENTO', 'DATADEPAGAMENTO', 'PAGAMENTO'],
  cashMonth: ['MESCX', 'MESCAIXA'],
  cashYear: ['ANOCX', 'ANOCAIXA'],
  description: ['HISTORICO', 'DESCRICAO'],
  unit: ['UNIDADE', 'BANCO'],
} as const

const REQUIRED_COLUMNS = ['classification', 'value'] as const

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

export function readLedger(table: RawTable): LedgerEntry[] | null {
  const header = findTableHeader(table.rows, COLUMN_ALIASES, REQUIRED_COLUMNS)
  if (!header || header.columns.paidAt === undefined) return null
  const hasCashMonth = header.columns.cashMonth !== undefined && header.columns.cashYear !== undefined

  const signed = (row: readonly string[]) => {
    if (header.columns.signedValue !== undefined) return header.number(row, 'signedValue')
    const value = Math.abs(header.number(row, 'value'))
    const movement = normalizeText(header.text(row, 'movement'))
    if (movement.startsWith('SAIDA') || movement.startsWith('DEBITO')) return -value
    if (movement.startsWith('ENTRADA') || movement.startsWith('CREDITO')) return value
    return header.number(row, 'value')
  }

  const cashPeriodOf = (row: readonly string[]): Period | null => {
    if (!hasCashMonth) return null
    const month = header.number(row, 'cashMonth')
    const year = header.number(row, 'cashYear')
    return isMonth(month) && isYear(year) ? { year, month } : null
  }

  const entries = table.rows.slice(header.rowIndex + 1).flatMap((row): LedgerEntry[] => {
    const classification = header.text(row, 'classification')
    const paid = parseDate(header.text(row, 'paidAt'))
    const value = signed(row)
    if (!classification || !paid || !value) return []
    return [
      {
        date: paid.iso,
        description: header.text(row, 'description'),
        classification,
        unit: header.text(row, 'unit'),
        value,
        period: cashPeriodOf(row) ?? paid.period,
      },
    ]
  })

  return entries.length ? entries : null
}
