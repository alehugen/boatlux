import { describe, expect, it } from 'vitest'
import { DreLineKind, DreReport, readLedger } from '@/domain/dre'
import { DRE_LINES, LEDGER_ROWS, dreRows } from '@/test/fixtures'

const ledgerTable = (rows: string[][]) => ({ name: 'Fluxo', sheet: 'Fluxo de Caixa', rows })

describe('readLedger', () => {
  it('lê os lançamentos pagos, com sinal pela movimentação e mês pela data de pagamento', () => {
    const entries = readLedger(ledgerTable(LEDGER_ROWS))!
    expect(entries).toHaveLength(7)
    expect(entries[0]).toEqual({
      date: '2026-03-05',
      description: 'Folha de março, parte 1',
      classification: 'Salários',
      unit: 'Matriz',
      value: -200,
      period: { year: 2026, month: 3 },
    })
    expect(entries.find((entry) => entry.classification === 'Produtos')!.value).toBe(400)
    expect(entries.some((entry) => entry.description.includes('ainda não pago'))).toBe(false)
  })

  it('prefere o valor com sinal e o mês de caixa quando a planilha traz essas colunas', () => {
    const entries = readLedger(
      ledgerTable([
        ['CLASSIFICAÇÃO', 'VALOR', 'DATA PAGTO', 'VALOR DE MOVIMENTO', 'MÊS CX.', 'ANO CX.'],
        ['Salários', '4178,34', '31/03/2026', '-4178,34', '4', '2026'],
      ]),
    )!
    expect(entries[0]).toMatchObject({ value: -4178.34, period: { year: 2026, month: 4 } })
  })

  it('não reconhece tabelas sem classificação, valor ou data de pagamento', () => {
    expect(readLedger(ledgerTable([['CLASSIFICAÇÃO', 'VALOR'], ['Salários', '10']]))).toBeNull()
    expect(readLedger(ledgerTable([['Produto', 'Valor'], ['A', '10']]))).toBeNull()
    expect(readLedger(ledgerTable([LEDGER_ROWS[0]!]))).toBeNull()
  })
})

describe('DreReport com lançamentos', () => {
  const report = DreReport.fromTables([
    { name: 'DRE', sheet: 'DRE Geral', rows: dreRows() },
    ledgerTable(LEDGER_ROWS),
  ])!
  const line = (label: string) => report.lines.find((candidate) => candidate.label === label)!
  const march = report.periods.findIndex((period) => period.month === 3)

  it('guarda os lançamentos da aba de fluxo de caixa', () => {
    expect(report.ledger).toHaveLength(7)
  })

  it('encontra os lançamentos de uma conta no mês', () => {
    expect(report.entriesOf(line('Salários'), march).map((entry) => entry.value)).toEqual([-200, -150])
  })

  it('junta as contas de um grupo e de uma seção', () => {
    expect(report.accountsOf(line('DESPESAS COM PESSOAL')).map((account) => account.label)).toEqual(['Salários'])
    expect(report.accountsOf(line('DESPESAS OPERACIONAIS')).map((account) => account.label)).toEqual(['Salários', 'Aluguel'])
    expect(report.entriesOf(line('DESPESAS OPERACIONAIS'), march).reduce((total, entry) => total + entry.value, 0)).toBe(-600)
  })

  it('não detalha linhas de resultado nem de saldo', () => {
    const result = report.lines.find((candidate) => candidate.kind === DreLineKind.Result)!
    expect(report.accountsOf(result)).toEqual([])
    expect(report.entriesOf(line('Salários'), 99)).toEqual([])
  })

  it('funciona sem aba de lançamentos', () => {
    expect(DreReport.fromTables([{ name: 'DRE', sheet: 'DRE Geral', rows: dreRows() }])!.ledger).toEqual([])
  })
})

describe('datas dos lançamentos', () => {
  const entriesWith = (dates: string[]) =>
    readLedger(
      ledgerTable([
        ['CLASSIFICAÇÃO', 'VALOR', 'DATA PAGTO'],
        ...dates.map((date, i) => ['Aluguel', String(-(i + 1)), date]),
      ]),
    ) ?? []

  it('converte dd/mm/aaaa e dd/mm/aa para ISO, para ordenar pela data real', () => {
    const entries = entriesWith(['15/01/2026', '2/3/26', '2026-02-10'])
    expect(entries.map((entry) => entry.date)).toEqual(['2026-01-15', '2026-03-02', '2026-02-10'])
    expect(entries.map((entry) => entry.period.month)).toEqual([1, 3, 2])
  })

  it('descarta datas impossíveis', () => {
    expect(entriesWith(['31/13/2026', '00/01/2026', 'ontem'])).toEqual([])
  })
})

describe('contas com o mesmo nome em grupos diferentes', () => {
  const lines = DRE_LINES.map((line) => (line?.[0] === 'Salários' ? (['Aluguel', ...line.slice(1)] as typeof line) : line))
  const report = DreReport.fromTables([
    { name: 'DRE', sheet: 'DRE Geral', rows: dreRows({ lines }) },
    ledgerTable(LEDGER_ROWS),
  ])!
  const groups = report.lines.filter((line) => line.kind === DreLineKind.Group && line.label.startsWith('DESPESAS'))

  it('não deixa abrir o detalhe, para não misturar lançamentos de grupos diferentes', () => {
    expect(groups).toHaveLength(2)
    expect(groups.every((group) => !report.isTraceable(group))).toBe(true)
    expect(report.isTraceable(report.lines.find((line) => line.label === 'Produtos')!)).toBe(true)
  })
})
