import { SourceFile, type FileParser, type RawTable } from '@/domain/ingestion'
import { recognizeReports, type Report, type ReportRepository } from '@/domain/report'
import { DomainError } from '@/domain/shared'

export class ImportFileUseCase {
  private readonly parsers: readonly FileParser[]
  private readonly repository: ReportRepository
  private readonly now: () => Date

  constructor(parsers: readonly FileParser[], repository: ReportRepository, now: () => Date = () => new Date()) {
    this.parsers = parsers
    this.repository = repository
    this.now = now
  }

  async execute(file: File): Promise<Report[]> {
    const source = SourceFile.fromFile(file)
    const tables = await this.parse(source)
    const reports = recognizeReports(tables, this.now())

    await Promise.all(reports.map((report) => this.repository.save(report)))
    return reports
  }

  private async parse(source: SourceFile): Promise<RawTable[]> {
    const parser = this.parsers.find((p) => p.format === source.format)
    if (!parser) throw new DomainError(`Nenhum leitor disponível para arquivos .${source.format}`)

    try {
      return await parser.parse(source)
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw new DomainError(`Não foi possível ler ${source.name}. Verifique se o arquivo não está corrompido ou protegido.`)
    }
  }
}
