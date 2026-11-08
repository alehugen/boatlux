

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

export type NumberConvention = 'br' | 'us'

const AMBIGUOUS_NUMBER = /^-?[1-9]\d{0,2}[.,]\d{3}$/
const GROUPED_BY = { '.': /^-?\d{1,3}(\.\d{3})+$/, ',': /^-?\d{1,3}(,\d{3})+$/ }

function cleanNumber(value: string): { text: string; negative: boolean } {
  const text = value.trim().replace(/R\$|%|\s/g, '').replace(/−/g, '-')
  const accounting = /^\(.*\)$/.test(text)
  const trailingMinus = /^[\d.,]+-$/.test(text)
  if (trailingMinus) return { text: text.slice(0, -1), negative: true }
  return { text: accounting ? text.slice(1, -1) : text, negative: accounting }
}

function decimalSeparator(text: string, convention?: NumberConvention): ',' | '.' | null {
  const commas = text.split(',').length - 1
  const dots = text.split('.').length - 1
  if (commas && dots) return text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.'
  if (commas > 1 || dots > 1 || (!commas && !dots)) return null
  const separator = commas ? ',' : '.'
  if (!AMBIGUOUS_NUMBER.test(text)) return separator
  if (convention === 'br') return separator === ',' ? ',' : null
  if (convention === 'us') return separator === '.' ? '.' : null
  return null
}

export function parseNumber(value: string, convention?: NumberConvention): number {
  const { text, negative } = cleanNumber(value)
  if (!text) return Number.NaN

  const decimal = decimalSeparator(text, convention)
  const [integer = '', fraction] = decimal ? text.split(decimal) : [text]
  const thousands = /[.,]/.exec(integer)?.[0] as '.' | ',' | undefined
  if (thousands && !GROUPED_BY[thousands].test(integer)) return Number.NaN
  if (fraction !== undefined && !/^\d+(e[+-]?\d+)?$/i.test(fraction)) return Number.NaN

  const normalized = `${integer.replace(/[.,]/g, '')}${fraction !== undefined ? `.${fraction}` : ''}`
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) return Number.NaN
  const number = Number(normalized)
  return negative ? -number : number
}

export function detectNumberConvention(values: readonly string[]): NumberConvention | undefined {
  let br = 0
  let us = 0
  for (const value of values) {
    const { text } = cleanNumber(value)
    if (!/\d/.test(text) || AMBIGUOUS_NUMBER.test(text)) continue
    const decimal = decimalSeparator(text)
    const commas = text.split(',').length - 1
    const dots = text.split('.').length - 1
    if (decimal === ',' || (decimal === null && dots > 1)) br++
    else if (decimal === '.' || (decimal === null && commas > 1)) us++
  }
  if (br && !us) return 'br'
  if (us && !br) return 'us'
  return undefined
}

export const sum = (values: readonly number[]): number =>
  values.reduce((acc, value) => (Number.isFinite(value) ? acc + value : acc), 0)

export const ratio = (part: number, total: number): number | null =>
  total && Number.isFinite(part) && Number.isFinite(total) ? part / total : null

export const relativeChange = (current: number, previous: number | null | undefined): number | null =>
  previous ? ratio(current - previous, Math.abs(previous)) : null

export interface Period {
  readonly year: number
  readonly month: number
}

export const periodKey = ({ year, month }: Period): string => `${year}-${String(month).padStart(2, '0')}`

export const comparePeriods = (a: Period, b: Period): number => a.year - b.year || a.month - b.month
