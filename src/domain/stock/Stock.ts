import { findTableHeader, type RawTable } from '@/domain/ingestion'
import { detectNumberConvention, normalizeText, parseNumber, sum } from '@/domain/shared'

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

/**
 * O que a observação da planilha diz sobre uma cota vendida: "upgrade L20" (o grupo da L20 passou para esta
 * embarcação) ou "Troca (L20)" (troca de embarcação com a L20, que não é venda).
 */
export interface StockMovement {
  readonly kind: 'upgrade' | 'exchange'
  /** A embarcação de onde veio o grupo, como L20. */
  readonly from: string
}

export interface SoldItem extends StockItem {
  /** A observação ao lado da cota, como está na planilha. */
  readonly note: string
  readonly movement: StockMovement | null
}

export interface SoldGroup {
  readonly label: string
  readonly items: readonly SoldItem[]
  /** Soma só as vendas: trocas ficam de fora. */
  readonly total: number
  /** Soma das cotas trocadas, que não entram no total. */
  readonly exchanged: number
}

export interface SoldStock {
  readonly items: readonly SoldItem[]
  readonly groups: readonly SoldGroup[]
  /** Valor vendido, sem as trocas. */
  readonly total: number
  /** Quantas cotas foram vendidas de fato (sem as trocas). */
  readonly sales: number
}

export interface Stock {
  /** Cotas disponíveis, já sem as que aparecem na lista de vendidas. */
  readonly items: readonly StockItem[]
  readonly groups: readonly StockGroup[]
  readonly total: number
  readonly sold: SoldStock | null
}

const COLUMN_ALIASES = {
  label: ['COTASDISPONIVEIS', 'COTA'],
  value: ['VALORDACOTA', 'VALOR'],
} as const

const groupOf = (label: string) => label.split(/\s*-\s*/)[0]!.trim() || label.trim()

/** "L31- 05" e "L31 - 05" são a mesma cota. */
const quotaKey = (label: string) => normalizeText(label).replace(/\s+/g, '')

function groupBy<Item extends StockItem>(items: readonly Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups]
}

const BOAT_CODE = String.raw`([A-Z]{1,2}\s*\d+)`
const UPGRADE = new RegExp(String.raw`UPGRADE\W*(?:D[AEO]S?\s+)?${BOAT_CODE}`)
const EXCHANGE = new RegExp(String.raw`TROCA\W*(?:(?:COM|PEL[AO]|D[AEO])\s+)?${BOAT_CODE}`)

export function movementOf(note: string): StockMovement | null {
  const text = normalizeText(note)
  const upgrade = UPGRADE.exec(text)
  if (upgrade) return { kind: 'upgrade', from: upgrade[1]!.replace(/\s+/g, '') }
  const exchange = EXCHANGE.exec(text)
  if (exchange) return { kind: 'exchange', from: exchange[1]!.replace(/\s+/g, '') }
  return /TROCA/.test(text) ? { kind: 'exchange', from: '' } : null
}

/** Onde começa a lista de vendidas: a célula "VENDIDAS", em qualquer coluna. */
function findSoldHeading(rows: readonly string[][]): { row: number; column: number } | null {
  for (let row = 0; row < rows.length; row++) {
    const column = rows[row]!.findIndex((cell) => /^(COTAS )?VENDIDAS?$/.test(normalizeText(cell ?? '')))
    if (column !== -1) return { row, column }
  }
  return null
}

/**
 * Lê a lista de cotas vendidas: abaixo de "VENDIDAS", a cota, o valor na coluna ao lado e a observação depois.
 * Para na primeira linha sem cota.
 */
function readSold(rows: readonly string[][]): SoldStock | null {
  const heading = findSoldHeading(rows)
  if (!heading) return null
  const body: string[][] = []
  for (const row of rows.slice(heading.row + 1)) {
    if (!(row[heading.column] ?? '').trim()) break
    body.push(row)
  }
  const convention = detectNumberConvention(body.map((row) => row[heading.column + 1] ?? ''))
  const items = body.flatMap((row): SoldItem[] => {
    const label = row[heading.column]!.trim()
    const value = parseNumber(row[heading.column + 1] ?? '', convention)
    const note = (row[heading.column + 2] ?? '').trim()
    return Number.isFinite(value) && value ? [{ label, group: groupOf(label), value, note, movement: movementOf(note) }] : []
  })
  if (!items.length) return null

  const isSale = (item: SoldItem) => item.movement?.kind !== 'exchange'
  const sales = items.filter(isSale)
  return {
    items,
    groups: groupBy(items).map(([label, own]) => ({
      label,
      items: own,
      total: sum(own.filter(isSale).map((item) => item.value)),
      exchanged: sum(own.filter((item) => !isSale(item)).map((item) => item.value)),
    })),
    total: sum(sales.map((item) => item.value)),
    sales: sales.length,
  }
}

/**
 * Lê a aba de estoque: as cotas disponíveis (um item por linha, com nome e valor) e, se houver, a lista de
 * vendidas. Uma cota que está nas duas listas conta como vendida e sai do estoque.
 */
export function readStock(table: RawTable): Stock | null {
  if (!normalizeText(table.sheet).includes('ESTOQUE')) return null
  const header = findTableHeader(table.rows, COLUMN_ALIASES, ['label', 'value'])
  if (!header) return null

  const sold = readSold(table.rows)
  const soldKeys = new Set(sold?.items.map((item) => quotaKey(item.label)))
  const items = table.rows.slice(header.rowIndex + 1).flatMap((row): StockItem[] => {
    const label = header.text(row, 'label')
    const value = header.number(row, 'value')
    return label && value && !soldKeys.has(quotaKey(label)) ? [{ label, group: groupOf(label), value }] : []
  })
  if (!items.length && !sold) return null

  return {
    items,
    groups: groupBy(items).map(([label, own]) => ({ label, items: own, total: sum(own.map((item) => item.value)) })),
    total: sum(items.map((item) => item.value)),
    sold,
  }
}
