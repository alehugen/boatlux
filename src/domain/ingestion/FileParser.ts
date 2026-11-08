import type { SourceFile } from './SourceFile'

/** Uma aba da planilha, com as células como texto. */
export interface RawTable {
  readonly sheet: string
  readonly rows: string[][]
  /** Fórmulas das células, nas mesmas posições de `rows`. Células sem fórmula ficam de fora. */
  readonly formulas?: ReadonlyMap<string, string>
}

/** Chave de uma célula no mapa de fórmulas, com linha e coluna a partir de zero. */
export const cellKey = (row: number, column: number): string => `${row}:${column}`

export interface FileParser {
  parse(file: SourceFile): Promise<RawTable[]>
}
