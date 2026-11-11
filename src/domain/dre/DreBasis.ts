import { normalizeText, type Period } from '@/domain/shared'
import { BOATLUX_LAYOUT, segmentOf, type DreSegment } from './DreLayout'
import type { LedgerEntry } from './Ledger'

/** Regime da DRE, como o seletor "Caixa / Competência" da planilha. */
export const DreRegime = {
  Cash: 'cash',
  Accrual: 'accrual',
} as const

export type DreRegime = (typeof DreRegime)[keyof typeof DreRegime]

/**
 * Como os valores da DRE são somados a partir do fluxo de caixa: o regime e o filtro do modelo da planilha,
 * a unidade na Boatlux (Repasse, Comercial, GC...) ou o banco na RS Náutica. `null` = sem filtro (todas/todos).
 */
export interface DreBasis {
  readonly regime: DreRegime
  readonly unit: string | null
}

export const DEFAULT_BASIS: DreBasis = { regime: DreRegime.Cash, unit: null }

const UNIT_SEGMENT = BOATLUX_LAYOUT.segment

/**
 * Chave para casar textos como o SOMASES do Excel: ignora maiúsculas e minúsculas e os espaços
 * nas pontas, mas não acentos nem espaços no meio do texto.
 */
export const categoryKey = (label: string): string => label.trim().toLocaleUpperCase('pt-BR')

export const basisKey = ({ regime, unit }: DreBasis): string => `${regime}:${unit === null ? '*' : categoryKey(unit)}`

export const sameBasis = (a: DreBasis, b: DreBasis): boolean => basisKey(a) === basisKey(b)

/** O filtro que vale de fato: na competência, um filtro que não se aplica a ela (banco, na RS) fica sem efeito. */
export const effectiveBasis = (basis: DreBasis, segment: DreSegment): DreBasis =>
  basis.regime === DreRegime.Accrual && !segment.inAccrual && basis.unit !== null ? { ...basis, unit: null } : basis

/** Se o lançamento é da unidade (ou do banco) escolhido, em qualquer regime, como na planilha. */
export const inUnit = (entry: LedgerEntry, basis: DreBasis, segment: DreSegment = UNIT_SEGMENT): boolean =>
  basis.unit === null || categoryKey(segmentOf(entry, segment)) === categoryKey(basis.unit)

/** O mês do lançamento no regime: pagamento no caixa, emissão na competência. */
export const periodInRegime = (entry: LedgerEntry, regime: DreRegime): Period | null =>
  regime === DreRegime.Accrual ? entry.accrualPeriod : entry.cashPeriod

/** A data que define o mês no regime (ISO, ou vazio). */
export const dateInRegime = (entry: LedgerEntry, regime: DreRegime): string =>
  regime === DreRegime.Accrual ? entry.issueDate : entry.date

/** O mês em que o lançamento entra na DRE no regime e no filtro escolhidos, ou `null` se não entra. */
export function periodInBasis(entry: LedgerEntry, basis: DreBasis, segment: DreSegment = UNIT_SEGMENT): Period | null {
  return inUnit(entry, basis, segment) ? periodInRegime(entry, basis.regime) : null
}

/**
 * Lê o que estava escolhido na planilha: a célula "Caixa" ou "Competência" (B2 na DRE Unidades, B1 na
 * DRE Geral da RS) e, logo abaixo, a unidade ou o banco. Um valor que não está nos lançamentos
 * (ex.: "TODAS") vira "sem filtro".
 */
export function readSheetBasis(rows: readonly string[][], units: readonly string[]): DreBasis | null {
  for (const [r, row] of rows.entries()) {
    for (const [c, cell] of row.entries()) {
      const text = normalizeText(cell)
      if (text !== 'CAIXA' && text !== 'COMPETENCIA') continue
      const below = rows[r + 1]?.[c] ?? ''
      const unit = units.find((name) => categoryKey(name) === categoryKey(below)) ?? null
      return { regime: text === 'CAIXA' ? DreRegime.Cash : DreRegime.Accrual, unit }
    }
  }
  return null
}
