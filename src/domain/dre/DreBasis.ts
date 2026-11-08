import { normalizeText, type Period } from '@/domain/shared'
import type { LedgerEntry } from './Ledger'

/** Regime da DRE, como o seletor "Caixa / Competência" da planilha. */
export const DreRegime = {
  Cash: 'cash',
  Accrual: 'accrual',
} as const

export type DreRegime = (typeof DreRegime)[keyof typeof DreRegime]

/**
 * Como os valores da DRE são somados a partir do fluxo de caixa.
 * No caixa dá para filtrar por banco (`null` = todas as contas); na competência a planilha soma todos os bancos.
 */
export interface DreBasis {
  readonly regime: DreRegime
  readonly bank: string | null
}

export const DEFAULT_BASIS: DreBasis = { regime: DreRegime.Cash, bank: null }

/**
 * Chave para casar a categoria do lançamento com a conta da DRE, com a mesma regra do SOMASES do Excel:
 * ignora maiúsculas e minúsculas, mas não acentos nem espaços no meio do texto.
 */
export const categoryKey = (label: string): string => label.trim().toLocaleUpperCase('pt-BR')

const bankKey = (bank: string) => bank.trim().toLocaleUpperCase('pt-BR')

export const basisKey = ({ regime, bank }: DreBasis): string =>
  regime === DreRegime.Accrual ? regime : `${regime}:${bank === null ? '*' : bankKey(bank)}`

export const sameBasis = (a: DreBasis, b: DreBasis): boolean => basisKey(a) === basisKey(b)

/** Se o lançamento é do banco escolhido. Na competência, todos os bancos contam. */
export const inBank = (entry: LedgerEntry, basis: DreBasis): boolean =>
  basis.regime === DreRegime.Accrual || basis.bank === null || bankKey(entry.bank) === bankKey(basis.bank)

/** O mês em que o lançamento entra na DRE no regime escolhido, ou `null` se não entra. */
export function periodInBasis(entry: LedgerEntry, basis: DreBasis): Period | null {
  if (!inBank(entry, basis)) return null
  return basis.regime === DreRegime.Accrual ? entry.accrualPeriod : entry.cashPeriod
}

const ALL_BANKS = 'TODAS'

/**
 * Lê o que estava escolhido na planilha: a célula "Caixa" ou "Competência" (B1 na DRE Geral) e,
 * logo abaixo, o banco (B2). Um banco sem lançamentos vira "todas as contas".
 */
export function readSheetBasis(rows: readonly string[][], banks: readonly string[]): DreBasis | null {
  for (const [r, row] of rows.entries()) {
    for (const [c, cell] of row.entries()) {
      const text = normalizeText(cell)
      if (text === 'COMPETENCIA') return { regime: DreRegime.Accrual, bank: null }
      if (text !== 'CAIXA') continue
      const below = rows[r + 1]?.[c] ?? ''
      const bank = normalizeText(below) === ALL_BANKS ? null : (banks.find((name) => bankKey(name) === bankKey(below)) ?? null)
      return { regime: DreRegime.Cash, bank }
    }
  }
  return null
}
