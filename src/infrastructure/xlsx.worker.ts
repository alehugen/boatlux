import { readWorkbook } from './readWorkbook'

/** Lê a planilha fora da página, para a tela não travar enquanto o arquivo (milhares de lançamentos) é aberto. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (event) => {
  try {
    scope.postMessage({ tables: readWorkbook(event.data) })
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
