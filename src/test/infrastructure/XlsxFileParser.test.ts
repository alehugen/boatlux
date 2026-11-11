import { describe, expect, it } from 'vitest'
import { utils, write, type WorkSheet } from 'xlsx'
import { cellKey, SourceFile } from '@/domain/ingestion'
import { readWorkbook } from '@/infrastructure/readWorkbook'
import { XlsxFileParser } from '@/infrastructure/XlsxFileParser'
import { boatluxFile } from '@/test/fixtures'

describe('XlsxFileParser', () => {
  it('lê as fórmulas de cada célula, nas mesmas posições das linhas', async () => {
    const tables = await new XlsxFileParser().parse(SourceFile.fromFile(boatluxFile()))
    const dre = tables.find((table) => table.sheet === 'DRE Unidades')!
    expect(dre.rows[4]![0]).toBe('RECEITA OPERACIONAL BRUTA')
    expect(dre.formulas?.get(cellKey(4, 2))).toBe('SUM(C6:C7)')
    expect(dre.formulas?.get(cellKey(5, 3))).toContain('SUMIFS')
    expect(tables.find((table) => table.sheet === 'Estoque')!.formulas?.size).toBe(0)
  })

  it('conta linhas e colunas a partir de A1 mesmo quando a planilha começa mais abaixo', () => {
    const sheet: WorkSheet = {
      B3: { t: 's', v: 'Receita' },
      C3: { t: 'n', v: 100 },
      C4: { t: 'n', v: 100, f: 'SUM(C3:C3)' },
      '!ref': 'B3:C4',
    }
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, sheet, 'DRE')
    const [table] = readWorkbook(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
    expect(table!.rows[2]![1]).toBe('Receita')
    expect(table!.rows[3]![2]).toBe('100')
    expect(table!.formulas?.get(cellKey(3, 2))).toBe('SUM(C3:C3)')
  })
})

describe('XlsxFileParser com Web Worker', () => {
  /** Um worker de mentira que responde como o de verdade. */
  function fakeWorker(reply: (content: ArrayBuffer) => unknown, fail = false) {
    const worker = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      onerror: null as ((event: { preventDefault(): void }) => void) | null,
      terminated: false,
      postMessage(content: ArrayBuffer) {
        queueMicrotask(() => (fail ? worker.onerror?.({ preventDefault() {} }) : worker.onmessage?.({ data: reply(content) })))
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
    expect(tables.map((table) => table.sheet)).toContain('DRE Unidades')
    expect(worker.terminated).toBe(true)
  })

  it('repassa o erro da planilha lido no worker', async () => {
    const source = SourceFile.fromFile(boatluxFile())
    const parser = new XlsxFileParser(() => fakeWorker(() => ({ error: 'arquivo inválido' })) as unknown as Worker)
    await expect(parser.parse(source)).rejects.toThrow('arquivo inválido')
  })

  it('sem worker disponível (bloqueado ou que não carrega), lê na página', async () => {
    const source = SourceFile.fromFile(boatluxFile())
    const broken = new XlsxFileParser(() => fakeWorker(() => null, true) as unknown as Worker)
    expect((await broken.parse(source)).map((table) => table.sheet)).toContain('DRE Unidades')
    const blocked = new XlsxFileParser(() => {
      throw new Error('CSP')
    })
    expect((await blocked.parse(source)).map((table) => table.sheet)).toContain('DRE Unidades')
  })
})
