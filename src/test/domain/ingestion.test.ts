import { describe, expect, it } from 'vitest'
import { detectFileFormat, findTableHeader, MAX_FILE_SIZE_MB, SourceFile } from '@/domain/ingestion'

describe('detectFileFormat', () => {
  it.each([
    ['relatorio.csv', null],
    ['DRE.XLSX', 'xlsx'],
    ['antigo.xls', 'xlsx'],
    ['foto.png', null],
    ['sem-extensao', null],
  ])('%s → %s', (name, expected) => {
    expect(detectFileFormat(name)).toBe(expected)
  })
})

describe('SourceFile.fromFile', () => {
  it('expõe formato e nome sem extensão', () => {
    const source = SourceFile.fromFile(new File(['x'], 'DRE out.2026.xlsx'))
    expect(source.format).toBe('xlsx')
    expect(source.baseName).toBe('DRE out.2026')
  })

  it('recusa formato não suportado, arquivo vazio e arquivo grande demais', () => {
    expect(() => SourceFile.fromFile(new File(['x'], 'foto.png'))).toThrow('Formato não suportado')
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
