import type { FileFormat } from './FileFormat'
import type { SourceFile } from './SourceFile'

export interface RawTable {
  readonly name: string
  readonly sheet?: string
  readonly rows: string[][]
}

export interface FileParser {
  readonly format: FileFormat
  parse(file: SourceFile): Promise<RawTable[]>
}
