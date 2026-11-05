import { describe, expect, it } from 'vitest'
import { DRE_LINES, dreRows } from '@/test/fixtures'
import { DreLineKind, DreMetric, DreReport } from '@/domain/dre'

const table = (rows = dreRows(), sheet = 'DRE Geral') => ({ name: `planilha · ${sheet}`, sheet, rows })
const parse = (rows = dreRows()) => DreReport.fromTable(table(rows))!

describe('DreReport.fromTable', () => {
  it('lê os meses do cabeçalho, descarta meses vazios nas pontas e ignora meses repetidos', () => {
    const report = parse()
    expect(report.periods).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ])
    expect(report.lines.every((line) => line.values.length === 3)).toBe(true)
    expect(report.lines.flatMap((line) => line.values)).not.toContain(999_999)
  })

  it('reconstrói a hierarquia pelos blocos da planilha', () => {
    const report = parse()
    const kindOf = (label: string) => report.lines.find((line) => line.label === label)?.kind

    expect(report.lines).toHaveLength(DRE_LINES.filter(Boolean).length)
    expect(kindOf('RECEITA OPERACIONAL BRUTA')).toBe(DreLineKind.Group)
    expect(kindOf('Serviços')).toBe(DreLineKind.Account)
    expect(kindOf('REPOSIÇÃO DE ESTOQUE')).toBe(DreLineKind.Account)
    expect(kindOf('LUCRO OPERACIONAL BRUTO')).toBe(DreLineKind.Result)
    expect(kindOf('DESPESAS OPERACIONAIS')).toBe(DreLineKind.Section)
    expect(kindOf('DESPESAS COM PESSOAL')).toBe(DreLineKind.Group)
    expect(kindOf('Saldo final')).toBe(DreLineKind.Balance)
  })

  it('liga grupos à seção e contas ao grupo', () => {
    const report = parse()
    const byLabel = (label: string) => report.lines.find((line) => line.label === label)!
    const section = byLabel('DESPESAS OPERACIONAIS')

    expect(report.children(section.id).map((line) => line.label)).toEqual(['DESPESAS COM PESSOAL', 'DESPESAS GERAIS'])
    expect(byLabel('Salários').parentId).toBe(byLabel('DESPESAS COM PESSOAL').id)
    expect(byLabel('LUCRO OPERACIONAL BRUTO').parentId).toBeNull()
  })

  it('reconhece as linhas-chave pelo nome', () => {
    const report = parse()
    expect(report.metric(DreMetric.GrossRevenue)?.label).toBe('RECEITA OPERACIONAL BRUTA')
    expect(report.metric(DreMetric.Ebitda)?.label).toBe('RESULTADO LÍQUIDO (EBITDA)')
    expect(report.metric(DreMetric.NetIncome)?.label).toBe('RESULTADO LÍQUIDO')
    expect(report.metric(DreMetric.EndingCash)?.label).toBe('Saldo final')
  })

  it('encontra os nomes das contas fora da coluna A', () => {
    const report = parse(dreRows({ labelColumn: 1 }))
    expect(report.metric(DreMetric.GrossRevenue)?.values).toEqual([1000, 1200, 900])
  })

  it('não reconhece tabelas sem cabeçalho de meses ou sem receita bruta', () => {
    expect(DreReport.fromTable({ name: 'x', rows: [['a', 'b'], ['1', '2']] })).toBeNull()
    const withoutRevenue = dreRows({ lines: [['OUTRA COISA', 0, 1, 2, 3]] })
    expect(DreReport.fromTable(table(withoutRevenue))).toBeNull()
  })
})

describe('DreReport.valueOf', () => {
  const report = parse()
  const all = [0, 1, 2]

  it('soma fluxos no intervalo', () => {
    expect(report.valueOf(report.metric(DreMetric.GrossRevenue), all)).toBe(3100)
  })

  it('usa o último mês para saldo final e o primeiro para saldo inicial', () => {
    expect(report.valueOf(report.metric(DreMetric.EndingCash), all)).toBe(290)
    const opening = report.lines.find((line) => line.label === 'Saldo inicial')
    expect(report.valueOf(opening, all)).toBe(50)
  })

  it('retorna zero sem linha ou sem períodos', () => {
    expect(report.valueOf(undefined, all)).toBe(0)
    expect(report.valueOf(report.metric(DreMetric.GrossRevenue), [])).toBe(0)
  })
})

describe('DreReport.fromTables', () => {
  it('prioriza a aba "DRE Geral" entre várias DREs', () => {
    const other = dreRows({ lines: [['RECEITA OPERACIONAL BRUTA', 0, 1, 1, 1], ['Única', 0, 1, 1, 1]] })
    const report = DreReport.fromTables([table(other, 'DRE Unidades'), table(dreRows(), 'DFC  DRE Geral')])
    expect(report?.name).toContain('DRE Geral')
  })
})

describe('DreReport: cabeçalho de meses', () => {
  it('reconhece uma DRE com um único mês', () => {
    const rows = [
      ['', '3'],
      ['DESCRIÇÃO', '2026'],
      ['RECEITA OPERACIONAL BRUTA', '500'],
      ['Vendas', '500'],
    ]
    const report = DreReport.fromTable({ name: 'DRE', rows })!
    expect(report.periods).toEqual([{ year: 2026, month: 3 }])
    expect(report.metric(DreMetric.GrossRevenue)?.values).toEqual([500])
  })

  it('escolhe a linha com mais meses, ignorando números soltos acima de um ano', () => {
    const rows = dreRows()
    rows.unshift(['', '7'], ['Relatório gerado em', '2026'])
    const report = DreReport.fromTable({ name: 'DRE', sheet: 'DRE Geral', rows })!
    expect(report.periods).toHaveLength(3)
    expect(report.periods[0]).toEqual({ year: 2026, month: 1 })
  })

  it('só considera meses já encerrados e registra os ignorados', () => {
    const report = DreReport.fromTable({ name: 'DRE', sheet: 'DRE Geral', rows: dreRows() }, new Date(2026, 2, 15))!
    expect(report.periods).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ])
    expect(report.ignoredPeriods).toEqual([{ year: 2026, month: 3 }])
    expect(report.metric(DreMetric.GrossRevenue)?.values).toEqual([1000, 1200])
  })

  it('explica quando a DRE só tem meses em aberto', () => {
    expect(() => DreReport.fromTables([{ name: 'DRE', sheet: 'DRE Geral', rows: dreRows() }], new Date(2026, 0, 20))).toThrow(
      'A DRE só tem meses que ainda não terminaram.',
    )
  })

  it('põe os meses em ordem cronológica mesmo com colunas fora de ordem', () => {
    const rows = [
      ['', '2', '12', '1'],
      ['DESCRIÇÃO', '2026', '2025', '2026'],
      ['RECEITA OPERACIONAL BRUTA', '300', '100', '200'],
      ['Vendas', '300', '100', '200'],
    ]
    const report = DreReport.fromTable({ name: 'DRE', rows })!
    expect(report.periods).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ])
    expect(report.metric(DreMetric.GrossRevenue)?.values).toEqual([100, 200, 300])
  })
})

describe('meses sem movimento', () => {
  it('não entram na análise só porque o saldo foi carregado do mês anterior', () => {
    const lines = DRE_LINES.map((line) => {
      if (!line || line[0].startsWith('Saldo')) return line
      const [label, ...values] = line
      return [label, ...values.slice(0, -1), 0] as const
    })
    const report = parse(dreRows({ lines }))
    expect(report.periods).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ])
    expect(report.ignoredPeriods).toEqual([])
  })
})
