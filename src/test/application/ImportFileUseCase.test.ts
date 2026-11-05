import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryReportRepository } from '@/infrastructure/InMemoryReportRepository'
import { XlsxFileParser } from '@/infrastructure/XlsxFileParser'
import { dreRows, xlsxFile } from '@/test/fixtures'
import { ImportFileUseCase } from '@/application'

let repository: InMemoryReportRepository
let importFile: ImportFileUseCase

beforeEach(() => {
  repository = new InMemoryReportRepository()
  importFile = new ImportFileUseCase([new XlsxFileParser()], repository)
})

const errorOf = async (file: File) => {
  try {
    await importFile.execute(file)
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe('ImportFileUseCase', () => {
  it('importa a DRE de uma planilha com várias abas', async () => {
    const file = xlsxFile('DRE.xlsx', { Fluxo: [['Data', 'Valor'], ['x', '1']], 'DFC  DRE Geral': dreRows() })
    const reports = await importFile.execute(file)
    expect(reports.map((r) => r.kind)).toEqual(['dre'])
    expect(reports[0]!.periods).toHaveLength(3)
    expect(await repository.findAll()).toHaveLength(1)
  })

  it('explica falhas com mensagens legíveis', async () => {
    expect(await errorOf(new File([], 'vazio.xlsx'))).toBe('O arquivo está vazio: vazio.xlsx')
    expect(await errorOf(new File(['a;b'], 'tabela.csv'))).toBe('Formato não suportado: tabela.csv')
    expect(await errorOf(new File(['x'], 'foto.png'))).toBe('Formato não suportado: foto.png')
    expect(await errorOf(xlsxFile('vendas.xlsx', { Jan: [['Item', 'Valor'], ['A', '1']] }))).toMatch(
      /^Não encontramos uma DRE neste arquivo/,
    )
    const brokenZip = new File([new Uint8Array([0x50, 0x4b, 3, 4, ...Array<number>(200).fill(7)])], 'quebrado.xlsx')
    expect(await errorOf(brokenZip)).toMatch(/^Não foi possível ler quebrado\.xlsx/)
  })
})
