import type { Period } from '@/domain/shared'

const LOCALE = 'pt-BR'

/**
 * "negative" não mostra sinal em zero nem em valores que arredondam para zero (sem "-R$ 0" nem "-0%");
 * "exceptZero" põe o "+" só quando o número exibido não é zero.
 */
type Sign = 'negative' | 'exceptZero'
const number = (options: Intl.NumberFormatOptions, sign: Sign = 'negative') =>
  new Intl.NumberFormat(LOCALE, { ...options, signDisplay: sign } as Intl.NumberFormatOptions)

const CURRENCY = { style: 'currency', currency: 'BRL' } as const
const WHOLE = { ...CURRENCY, maximumFractionDigits: 0 } as const
const PERCENT = { style: 'percent', maximumFractionDigits: 1 } as const

const numberFormatter = number({ maximumFractionDigits: 2 })
const compactFormatter = number({ notation: 'compact', maximumFractionDigits: 1 })
const currencyFormatter = number(CURRENCY)
const currencyCompactFormatter = number({ ...CURRENCY, notation: 'compact', maximumFractionDigits: 1 })
const currencyWholeFormatter = number(WHOLE)
const signedCurrencyFormatter = number(WHOLE, 'exceptZero')
const percentFormatter = number(PERCENT)
const signedPercentFormatter = number(PERCENT, 'exceptZero')
const monthLongFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })

export const formatNumber = (value: number) => numberFormatter.format(value)
export const formatCompact = (value: number) => compactFormatter.format(value)
export const formatCurrency = (value: number) => currencyFormatter.format(value)
export const formatCurrencyWhole = (value: number) => currencyWholeFormatter.format(value)
export const formatSignedCurrency = (value: number) => signedCurrencyFormatter.format(value)
export const formatCurrencyCompact = (value: number) => currencyCompactFormatter.format(value)
export const formatPercent = (value: number) => percentFormatter.format(value)
export const formatSignedPercent = (value: number) => signedPercentFormatter.format(value)

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const formatPeriod = ({ year, month }: Period) => `${MONTHS[month - 1]}/${String(year).slice(2)}`
/** "a, b e c". */
export const joinList = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : (items[0] ?? '')
export const formatPeriodList = (periods: readonly Period[]) => joinList(periods.map(formatPeriod))
/** "2026-10-01" (com ou sem hora) → "01/10/2026"; outro texto fica como está. */
export const formatIsoDate = (date: string) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : date
}
export const formatPeriodLong = ({ year, month }: Period) => monthLongFormatter.format(new Date(year, month - 1))
const KEEP_UPPER = new Set(['EBITDA', 'ISS', 'IPI', 'ICMS', 'PIS', 'COFINS', 'IRPJ', 'CSLL', 'INSS', 'FGTS', 'DRE'])

export function prettifyLabel(label: string): string {
  const text = label.trim()
  if (text !== text.toUpperCase()) return text
  return text
    .toLowerCase()
    .replace(/\p{L}+/gu, (word) => (KEEP_UPPER.has(word.toUpperCase()) ? word.toUpperCase() : word))
    .replace(/^\p{L}/u, (char) => char.toUpperCase())
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!)
