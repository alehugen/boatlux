import { AnalyzeDreUseCase, ImportFileUseCase, ListReportsUseCase, RemoveReportUseCase } from '@/application'
import { InMemoryReportRepository } from './InMemoryReportRepository'
import { XlsxFileParser } from './XlsxFileParser'

const reportRepository = new InMemoryReportRepository()
const parsers = [new XlsxFileParser()]

export const container = {
  importFile: new ImportFileUseCase(parsers, reportRepository),
  listReports: new ListReportsUseCase(reportRepository),
  removeReport: new RemoveReportUseCase(reportRepository),
  analyzeDre: new AnalyzeDreUseCase(),
}
