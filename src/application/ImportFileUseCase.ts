import { DreReport } from '@/domain/dre'
import { SourceFile, type FileParser, type RawTable } from '@/domain/ingestion'
import { DomainError } from '@/domain/shared'

/** Importa a planilha da Boatlux e monta a DRE. */
export class ImportFileUseCase {
  private readonly parser: FileParser
  private readonly now: () => Date

  constructor(parser: FileParser, now: () => Date = () => new Date()) {
    this.parser = parser
    this.now = now
  }

  async execute(file: File): Promise<DreReport> {
    const source = SourceFile.fromFile(file)
    const tables = await this.parse(source)
    if (!tables.length) throw new DomainError('O arquivo não contém dados.')
    return DreReport.fromWorkbook(tables, { name: source.baseName, asOf: this.now() })
  }

  private async parse(source: SourceFile): Promise<RawTable[]> {
    try {
      return await this.parser.parse(source)
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw new DomainError(`Não foi possível ler ${source.name}. Verifique se o arquivo não está corrompido ou protegido.`)
    }
  }
}
