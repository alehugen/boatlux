import { describe, expect, it } from 'vitest'
import { dreRows } from '@/test/fixtures'
import { recognizeReports } from '@/domain/report'

describe('recognizeReports', () => {
  it('reconhece a DRE e ignora as demais abas da planilha', () => {
    const reports = recognizeReports([
      { name: 'p · Fluxo', sheet: 'Fluxo', rows: [['Data', 'Valor'], ['2026-01-01', '10']] },
      { name: 'p · DRE Geral', sheet: 'DRE Geral', rows: dreRows() },
    ])
    expect(reports.map((r) => r.kind)).toEqual(['dre'])
  })

  it('recusa planilhas que não são uma DRE', () => {
    expect(() => recognizeReports([{ name: 'vendas', rows: [['Item', 'Valor'], ['A', '1']] }])).toThrow(
      /Não encontramos uma DRE neste arquivo/,
    )
  })

  it('recusa arquivos sem dados', () => {
    expect(() => recognizeReports([{ name: 'vazio', rows: [['', ' '], []] }])).toThrow('O arquivo não contém dados.')
  })
})
