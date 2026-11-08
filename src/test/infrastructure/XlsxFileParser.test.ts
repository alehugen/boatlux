import { describe, expect, it } from 'vitest'
import { cellKey, SourceFile } from '@/domain/ingestion'
import { readWorkbook } from '@/infrastructure/readWorkbook'
import { XlsxFileParser } from '@/infrastructure/XlsxFileParser'
import { boatluxFile } from '@/test/fixtures'

describe('XlsxFileParser', () => {
  it('lê as fórmulas de cada célula, nas mesmas posições das linhas', async () => {
    const tables = await new XlsxFileParser().parse(SourceFile.fromFile(boatluxFile()))
    const dre = tables.find((table) => table.sheet === 'DRE Geral')!
    expect(dre.rows[4]![0]).toBe('RECEITA OPERACIONAL BRUTA')
    expect(dre.formulas?.get(cellKey(4, 2))).toBe('SUM(C6:C7)')
    expect(dre.formulas?.get(cellKey(5, 3))).toContain('SUMIFS')
    expect(tables.find((table) => table.sheet === 'Estoque')!.formulas?.size).toBe(0)
  })
})

describe('XlsxFileParser com Web Worker', () => {
  /** Um worker de mentira que responde como o de verdade. */
  function fakeWorker(reply: (content: ArrayBuffer) => unknown, fail = false) {
    const worker = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      onerror: null as (() => void) | null,
      terminated: false,
      postMessage(content: ArrayBuffer) {
        queueMicrotask(() => (fail ? worker.onerror?.() : worker.onmessage?.({ data: reply(content) })))
      },
      terminate() {
        worker.terminated = true
      },
    }
    return worker
  }

  it('lê no worker e encerra o worker ao terminar', async () => {
    const worker = fakeWorker((content) => ({ tables: readWorkbook(content) }))
    const tables = await new XlsxFileParser(() => worker as unknown as Worker).parse(SourceFile.fromFile(boatluxFile()))
    expect(tables.map((table) => table.sheet)).toContain('DRE Geral')
    expect(worker.terminated).toBe(true)
  })

  it('repassa as falhas do worker', async () => {
    const source = SourceFile.fromFile(boatluxFile())
    await expect(new XlsxFileParser(() => fakeWorker(() => ({ error: true })) as unknown as Worker).parse(source)).rejects.toThrow()
    await expect(new XlsxFileParser(() => fakeWorker(() => null, true) as unknown as Worker).parse(source)).rejects.toThrow()
  })
})
