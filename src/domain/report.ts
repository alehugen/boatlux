import { DreReport } from '@/domain/dre'
import type { RawTable } from '@/domain/ingestion'
import { DomainError, type Identifier } from '@/domain/shared'

export type Report = DreReport

export interface ReportRepository {
  save(report: Report): Promise<void>
  findAll(): Promise<Report[]>
  remove(id: Identifier): Promise<void>
}

const hasData = (table: RawTable) => table.rows.some((row) => row.some((cell) => cell.trim() !== ''))

export function recognizeReports(tables: readonly RawTable[], asOf: Date = new Date()): Report[] {
  const filled = tables.filter(hasData)
  if (!filled.length) throw new DomainError('O arquivo não contém dados.')

  const dre = DreReport.fromTables(filled, asOf)
  if (!dre) {
    throw new DomainError(
      'Não encontramos uma DRE neste arquivo. A planilha precisa ter a linha dos meses (1 a 12), a dos anos logo abaixo e a linha "Receita operacional bruta".',
    )
  }
  return [dre]
}
