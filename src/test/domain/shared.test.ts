import { describe, expect, it } from 'vitest'
import {
  compareByPeriod,
  comparePeriods,
  detectNumberConvention,
  normalizeText,
  parseNumber,
  parsePeriodFromText,
  periodKey,
  ratio,
  relativeChange,
  sum,
} from '@/domain/shared'

describe('normalizeText', () => {
  it('ignora acentos, caixa e espaços repetidos', () => {
    expect(normalizeText('  Margem   de Contribuição ')).toBe('MARGEM DE CONTRIBUICAO')
  })
})

describe('parseNumber', () => {
  it.each([
    ['15940.95', 15940.95],
    ['-1,056.82', -1056.82],
    ['1.234,56', 1234.56],
    ['12,2222222222222', 12.2222222222222],
    ['1.234.567', 1234567],
    ['1,234', 1234],
    ['R$ 1.500,00', 1500],
    ['15%', 15],
    ['(1.234,00)', -1234],
    ['−3', -3],
    ['1e-7', 1e-7],
    ['0', 0],
  ])('lê "%s" como %d', (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected, 10)
  })

  it.each(['', '   ', 'Meningite B', '01.02.2026', '2026-09-30', '1-2', '1.23.4'])('não trata "%s" como número', (input) => {
    expect(parseNumber(input)).toBeNaN()
  })

  it.each([
    ['0,500', 0.5],
    ['0.125', 0.125],
    ['-0,125', -0.125],
    ['1.234', 1234],
  ])('sem padrão da coluna, lê "%s" como %d', (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected, 10)
  })

  it.each([
    ['1,500', 'br', 1.5],
    ['1.500', 'br', 1500],
    ['1,500', 'us', 1500],
    ['1.500', 'us', 1.5],
    ['1.234,5', 'us', 1234.5],
  ] as const)('com padrão da coluna, lê "%s" (%s) como %d', (input, convention, expected) => {
    expect(parseNumber(input, convention)).toBeCloseTo(expected, 10)
  })
})

describe('detectNumberConvention', () => {
  it.each([
    [['1,500', '12,25', '3'], 'br'],
    [['1,500', '1.234.567'], 'br'],
    [['1,500', '12.25'], 'us'],
    [['1,500', '1,234,567'], 'us'],
    [['1,500', '2.000', '3'], undefined],
    [['12,5', '12.5'], undefined],
  ] as const)('em %j, detecta %s', (values, expected) => {
    expect(detectNumberConvention(values)).toBe(expected)
  })
})

describe('sum', () => {
  it('ignora valores não finitos', () => {
    expect(sum([1, Number.NaN, 2, Number.POSITIVE_INFINITY])).toBe(3)
  })
})

describe('períodos', () => {
  it('gera chave ordenável', () => {
    expect(periodKey({ year: 2026, month: 3 })).toBe('2026-03')
  })

  it('compara por ano e depois por mês', () => {
    expect(comparePeriods({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0)
    expect(comparePeriods({ year: 2026, month: 5 }, { year: 2026, month: 2 })).toBeGreaterThan(0)
  })
})

describe('parsePeriodFromText', () => {
  it.each([
    ['Relatório_Curva_ABC- set.2026', { year: 2026, month: 9 }],
    ['curva_abc_set_2026', { year: 2026, month: 9 }],
    ['Curva ABC setembro de 2026', { year: 2026, month: 9 }],
    ['abc março 2026', { year: 2026, month: 3 }],
    ['abc out/26', { year: 2026, month: 10 }],
    ['Relatório_Lucro_por_Produto-out.2026', { year: 2026, month: 10 }],
    ['abc_09-2026', { year: 2026, month: 9 }],
    ['abc 2026_09', { year: 2026, month: 9 }],
  ])('extrai o mês de "%s"', (input, expected) => {
    expect(parsePeriodFromText(input)).toEqual(expected)
  })

  it.each(['MARGEM 2026', 'abc 00-2026', 'abc 13-2026', 'relatorio'])('não inventa mês em "%s"', (input) => {
    expect(parsePeriodFromText(input)).toBeNull()
  })
})

describe('ratio', () => {
  it('divide com proteção contra zero e valores inválidos', () => {
    expect(ratio(1, 4)).toBe(0.25)
    expect(ratio(1, 0)).toBeNull()
    expect(ratio(Number.NaN, 2)).toBeNull()
    expect(ratio(1, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('relativeChange', () => {
  it.each([
    [120, 100, 0.2],
    [80, 100, -0.2],
    [-50, -100, 0.5],
    [-150, -100, -0.5],
    [50, -100, 1.5],
  ])('de %d para %d varia %d', (current, previous, expected) => {
    expect(relativeChange(current, previous)).toBeCloseTo(expected)
  })

  it('não calcula sem base de comparação', () => {
    expect(relativeChange(10, 0)).toBeNull()
    expect(relativeChange(10, null)).toBeNull()
    expect(relativeChange(10, undefined)).toBeNull()
  })
})

describe('compareByPeriod', () => {
  it('ordena por mês e deixa relatórios sem mês no fim', () => {
    const items = [
      { name: 'sem mês', period: null },
      { name: 'out', period: { year: 2026, month: 10 } },
      { name: 'set', period: { year: 2026, month: 9 } },
    ]
    expect([...items].sort(compareByPeriod).map((item) => item.name)).toEqual(['set', 'out', 'sem mês'])
  })
})
