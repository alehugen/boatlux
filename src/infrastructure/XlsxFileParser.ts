import type { FileParser, RawTable, SourceFile } from '@/domain/ingestion'

type WorkerReply = { tables: RawTable[] } | { error: true }

/** Lê a planilha num Web Worker quando houver um; senão (testes, navegadores antigos), na própria página. */
export class XlsxFileParser implements FileParser {
  private readonly createWorker: (() => Worker) | null

  constructor(createWorker: (() => Worker) | null = null) {
    this.createWorker = createWorker
  }

  async parse(file: SourceFile): Promise<RawTable[]> {
    const content = await file.content.arrayBuffer()
    if (!this.createWorker) return (await import('./readWorkbook')).readWorkbook(content)

    const worker = this.createWorker()
    try {
      return await new Promise<RawTable[]>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerReply>) =>
          'tables' in data ? resolve(data.tables) : reject(new Error('Falha ao ler a planilha'))
        worker.onerror = () => reject(new Error('Falha ao ler a planilha'))
        worker.postMessage(content, [content])
      })
    } finally {
      worker.terminate()
    }
  }
}
