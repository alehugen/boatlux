import type { LedgerEntry } from './Ledger'

/**
 * Por onde a DRE pode ser filtrada, como o segundo seletor da planilha: a unidade (Boatlux) ou o banco
 * (RS Náutica). `inAccrual` diz se o filtro vale na competência: na RS, os lançamentos de competência
 * não têm banco, e a fórmula da planilha soma todos.
 */
export interface DreSegment {
  readonly kind: 'unit' | 'bank'
  /** Rótulo do seletor: "Unidade", "Banco". */
  readonly label: string
  /** A opção sem filtro: "Todas as unidades", "Todos os bancos". */
  readonly all: string
  readonly inAccrual: boolean
}

export type CompanyId = 'boatlux' | 'rs-nautica'

/** O modelo de planilha de cada operação: a aba da DRE e o filtro dela. */
export interface DreLayout {
  readonly id: CompanyId
  readonly company: string
  /** Nome da aba da DRE, como aparece na planilha. */
  readonly sheet: string
  readonly segment: DreSegment
}

export const BOATLUX_LAYOUT: DreLayout = {
  id: 'boatlux',
  company: 'Boatlux',
  sheet: 'DRE Unidades',
  segment: { kind: 'unit', label: 'Unidade', all: 'Todas as unidades', inAccrual: true },
}

export const RS_NAUTICA_LAYOUT: DreLayout = {
  id: 'rs-nautica',
  company: 'RS Náutica',
  sheet: 'DRE Geral',
  segment: { kind: 'bank', label: 'Banco', all: 'Todos os bancos', inAccrual: false },
}

/**
 * Os modelos na ordem em que são tentados. A planilha da RS também tem uma "DRE Unidades", mas zerada
 * (sem unidade escolhida): por isso a Boatlux só vale quando a DRE Unidades tem receita.
 */
export const DRE_LAYOUTS: readonly DreLayout[] = [BOATLUX_LAYOUT, RS_NAUTICA_LAYOUT]

/** O valor do filtro num lançamento: a unidade ou o banco. */
export const segmentOf = (entry: LedgerEntry, segment: DreSegment): string =>
  segment.kind === 'bank' ? entry.bank : entry.unit
