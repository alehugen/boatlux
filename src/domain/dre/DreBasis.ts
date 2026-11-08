import { normalizeText, type Period } from '@/domain/shared'
import type { LedgerEntry } from './Ledger'

/** Regime da DRE, como o seletor "Caixa / Competência" da planilha. */
export const DreRegime = {
  Cash: 'cash',
  Accrual: 'accrual',
} as const

export type DreRegime = (typeof DreRegime)[keyof typeof DreRegime]

/**
 * Como os valores da DRE são somados a partir do fluxo de caixa: o regime e a unidade
 * (Repasse, Comercial, GC...), como os seletores B2 e B3 da aba DRE Unidades. `null` = todas as unidades.
 */
export interface DreBasis {
  readonly regime: DreRegime
  readonly unit: string | null
}

export const DEFAULT_BASIS: DreBasis = { regime: DreRegime.Cash, unit: null }

/**
 * Chave para casar textos como o SOMASES do Excel: ignora maiúsculas e minúsculas e os espaços
 * nas pontas, mas não acentos nem espaços no meio do texto.
 */
export const categoryKey = (label: string): string => label.trim().toLocaleUpperCase('pt-BR')

export const basisKey = ({ regime, unit }: DreBasis): string => `${regime}:${unit === null ? '*' : categoryKey(unit)}`

export const sameBasis = (a: DreBasis, b: DreBasis): boolean => basisKey(a) === basisKey(b)

/** Se o lançamento é da unidade escolhida (em qualquer regime, como na planilha). */
export const inUnit = (entry: LedgerEntry, basis: DreBasis): boolean =>
  basis.unit === null || categoryKey(entry.unit) === categoryKey(basis.unit)

/** O mês do lançamento no regime: pagamento no caixa, emissão na competência. */
export const periodInRegime = (entry: LedgerEntry, regime: DreRegime): Period | null =>
  regime === DreRegime.Accrual ? entry.accrualPeriod : entry.cashPeriod

/** A data que define o mês no regime (ISO, ou vazio). */
export const dateInRegime = (entry: LedgerEntry, regime: DreRegime): string =>
  regime === DreRegime.Accrual ? entry.issueDate : entry.date

/** O mês em que o lançamento entra na DRE no regime e na unidade escolhidos, ou `null` se não entra. */
export function periodInBasis(entry: LedgerEntry, basis: DreBasis): Period | null {
  return inUnit(entry, basis) ? periodInRegime(entry, basis.regime) : null
}

/**
 * Lê o que estava escolhido na planilha: a célula "Caixa" ou "Competência" (B2 na DRE Unidades) e,
 * logo abaixo, a unidade (B3). Uma unidade sem lançamentos vira "todas as unidades".
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
