import { describe, expect, it } from 'vitest'
import { ImportFileUseCase } from '@/application'
import { XlsxFileParser } from '@/infrastructure/XlsxFileParser'
import { boatluxFile, dreRows, xlsxFile } from '@/test/fixtures'

const importFile = new ImportFileUseCase(new XlsxFileParser(), () => new Date(2026, 10, 7))

const errorOf = async (file: File) => {
  try {
    await importFile.execute(file)
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe('ImportFileUseCase', () => {
  it('monta a DRE da planilha da Boat Lux, com o nome do arquivo', async () => {
    const report = await importFile.execute(boatluxFile())
    expect(report.name).toBe('Fechamento 2026')
    expect(report.canChangeBasis).toBe(true)
    expect(report.debts?.debts).toHaveLength(2)
    expect(report.stock?.items).toHaveLength(5)
  })

  it('lê a aba "DRE Geral" mesmo com outras abas parecidas', async () => {
    const other = dreRows({ lines: [['RECEITA OPERACIONAL BRUTA', 0, 1, 1, 1], ['Única', 0, 1, 1, 1]] })
    const report = await importFile.execute(xlsxFile('DRE.xlsx', { 'DRE Unidades': other, 'DRE Geral': dreRows() }))
    expect(report.metric('grossRevenue')?.values).toEqual([1000, 1200, 900])
  })

  it('explica falhas com mensagens legíveis', async () => {
    expect(await errorOf(new File([], 'vazio.xlsx'))).toBe('O arquivo está vazio: vazio.xlsx')
    expect(await errorOf(new File(['a;b'], 'tabela.csv'))).toMatch(/^Formato não suportado: tabela\.csv/)
    expect(await errorOf(xlsxFile('vendas.xlsx', { Jan: [['Item', 'Valor'], ['A', '1']] }))).toBe(
      'Não encontramos a aba "DRE Geral" nesta planilha.',
    )
    expect(await errorOf(xlsxFile('dre.xlsx', { 'DRE Geral': [['Item', 'Valor'], ['A', '1']] }))).toMatch(/linha dos meses/)
    expect(await errorOf(xlsxFile('vazia.xlsx', { Plan1: [['']] }))).toBe('O arquivo não contém dados.')
    const brokenZip = new File([new Uint8Array([0x50, 0x4b, 3, 4, ...Array<number>(200).fill(7)])], 'quebrado.xlsx')
    expect(await errorOf(brokenZip)).toMatch(/^Não foi possível ler quebrado\.xlsx/)
  })

  it('explica quando a DRE só tem meses em aberto', async () => {
    const early = new ImportFileUseCase(new XlsxFileParser(), () => new Date(2026, 0, 20))
    await expect(early.execute(xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() }))).rejects.toThrow(
      'A DRE só tem meses que ainda não terminaram.',
    )
  })
})
