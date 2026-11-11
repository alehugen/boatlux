import type { FileParser, RawTable, SourceFile } from '@/domain/ingestion'

type WorkerReply = { tables: RawTable[] } | { error: string }

/** O worker não chegou a rodar (bloqueado ou sem suporte): lê na página. */
class WorkerUnavailable extends Error {}

/** Lê a planilha num Web Worker quando houver um; senão (testes, navegadores antigos), na própria página. */
export class XlsxFileParser implements FileParser {
  private readonly createWorker: (() => Worker) | null

  constructor(createWorker: (() => Worker) | null = null) {
    this.createWorker = createWorker
  }

  async parse(file: SourceFile): Promise<RawTable[]> {
    if (this.createWorker) {
      try {
        return await this.inWorker(this.createWorker, await file.content.arrayBuffer())
      } catch (error) {
        if (!(error instanceof WorkerUnavailable)) throw error
      }
    }
    // O conteúdo enviado ao worker foi transferido; lê o arquivo de novo.
    return (await import('./readWorkbook')).readWorkbook(await file.content.arrayBuffer())
  }

  private async inWorker(createWorker: () => Worker, content: ArrayBuffer): Promise<RawTable[]> {
    let worker: Worker
    try {
      worker = createWorker()
    } catch {
      throw new WorkerUnavailable()
    }
    try {
      return await new Promise<RawTable[]>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerReply>) =>
          'tables' in data ? resolve(data.tables) : reject(new Error(data.error))
        // Erro do próprio worker (script não carregou), não da planilha.
        worker.onerror = (event) => {
          event.preventDefault()
          reject(new WorkerUnavailable())
        }
        worker.postMessage(content, [content])
      })
    } finally {
      worker.terminate()
    }
  }
}
