import { AnalyzeDreUseCase, ImportFileUseCase } from '@/application'
import { XlsxFileParser } from './XlsxFileParser'

const createWorker =
  typeof Worker === 'undefined' ? null : () => new Worker(new URL('./xlsx.worker.ts', import.meta.url), { type: 'module' })

export const container = {
  importFile: new ImportFileUseCase(new XlsxFileParser(createWorker)),
  analyzeDre: new AnalyzeDreUseCase(),
}
