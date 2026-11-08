import { findTableHeader, type RawTable } from '@/domain/ingestion'
import { normalizeText, sum } from '@/domain/shared'

export interface StockItem {
  readonly label: string
  /** O bem a que o item pertence: em "L29 - 03", a embarcação L29. */
  readonly group: string
  readonly value: number
}

export interface StockGroup {
  readonly label: string
  readonly items: readonly StockItem[]
  readonly total: number
}

export interface Stock {
  readonly items: readonly StockItem[]
  readonly groups: readonly StockGroup[]
  readonly total: number
}

const COLUMN_ALIASES = {
  label: ['COTASDISPONIVEIS', 'COTA'],
  value: ['VALORDACOTA', 'VALOR'],
} as const

const groupOf = (label: string) => label.split(/\s*-\s*/)[0]!.trim() || label.trim()

/** Lê a aba de estoque: um item por linha, com nome e valor. */
export function readStock(table: RawTable): Stock | null {
  if (!normalizeText(table.sheet).includes('ESTOQUE')) return null
  const header = findTableHeader(table.rows, COLUMN_ALIASES, ['label', 'value'])
  if (!header) return null

  const items = table.rows.slice(header.rowIndex + 1).flatMap((row): StockItem[] => {
    const label = header.text(row, 'label')
    const value = header.number(row, 'value')
    return label && value ? [{ label, group: groupOf(label), value }] : []
  })
  if (!items.length) return null

  const groups = new Map<string, StockItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])

  return {
    items,
    groups: [...groups].map(([label, own]) => ({ label, items: own, total: sum(own.map((item) => item.value)) })),
    total: sum(items.map((item) => item.value)),
  }
}
