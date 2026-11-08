import type { Period } from '@/domain/shared'

const LOCALE = 'pt-BR'

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const compactFormatter = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const currencyFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' })
const currencyCompactFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const currencyWholeFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const percentFormatter = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 })
const pointsFormatter = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const monthLongFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })

export const formatNumber = (value: number) => numberFormatter.format(value)
export const formatCompact = (value: number) => compactFormatter.format(value)
export const formatCurrency = (value: number) => currencyFormatter.format(value)
export const formatCurrencyWhole = (value: number) => currencyWholeFormatter.format(value)
export const formatSignedCurrency = (value: number) => (value > 0 ? '+' : '') + currencyWholeFormatter.format(value)
export const formatCurrencyCompact = (value: number) => currencyCompactFormatter.format(value)
export const formatPercent = (value: number) => percentFormatter.format(value)
export const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${percentFormatter.format(value)}`
export const formatSignedPoints = (value: number) =>
  `${value > 0 ? '+' : ''}${pointsFormatter.format(value * 100)} p.p.`

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const formatPeriod = ({ year, month }: Period) => `${MONTHS[month - 1]}/${String(year).slice(2)}`
export const formatPeriodList = (periods: readonly Period[]) => {
  const labels = periods.map(formatPeriod)
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}` : (labels[0] ?? '')
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
