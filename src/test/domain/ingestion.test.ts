import { describe, expect, it } from 'vitest'
import { findTableHeader, MAX_FILE_SIZE_MB, SourceFile } from '@/domain/ingestion'

describe('SourceFile.fromFile', () => {
  it('aceita .xlsx e .xls e expõe o nome sem extensão', () => {
    expect(SourceFile.fromFile(new File(['x'], 'DRE out.2026.xlsx')).baseName).toBe('DRE out.2026')
    expect(SourceFile.fromFile(new File(['x'], 'ANTIGO.XLS')).name).toBe('ANTIGO.XLS')
  })

  it('recusa formato não suportado, arquivo vazio e arquivo grande demais', () => {
    for (const name of ['foto.png', 'relatorio.csv', 'sem-extensao']) {
      expect(() => SourceFile.fromFile(new File(['x'], name))).toThrow('Formato não suportado')
    }
    expect(() => SourceFile.fromFile(new File([], 'vazio.xlsx'))).toThrow('O arquivo está vazio')
    const huge = new File(['x'], 'grande.xlsx')
    Object.defineProperty(huge, 'size', { value: (MAX_FILE_SIZE_MB + 1) * 1024 * 1024 })
    expect(() => SourceFile.fromFile(huge)).toThrow(`limite de ${MAX_FILE_SIZE_MB} MB`)
  })
})

describe('findTableHeader', () => {
  const aliases = { name: ['NOME', 'DESCRICAO'], amount: ['VALOR'], code: ['CODIGO'] }

  it('encontra o cabeçalho por apelido, ignorando acento e pontuação', () => {
    const header = findTableHeader([['Título'], ['Descrição', 'Valor (R$)', 'Código']], aliases, ['name'])!
    expect(header.rowIndex).toBe(1)
    expect(header.columns).toEqual({ name: 0, code: 2 })
    expect(header.text(['  X ', '10'], 'name')).toBe('X')
    expect(header.number(['X', 'abc'], 'name')).toBe(0)
  })

  it('retorna null sem as colunas obrigatórias', () => {
    expect(findTableHeader([['Descrição']], aliases, ['name', 'amount'])).toBeNull()
  })
})
