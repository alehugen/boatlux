import { describe, expect, it } from 'vitest'
import { columnLetters, DreRegime, DreReport, parseLineFormula } from '@/domain/dre'
import type { RawTable } from '@/domain/ingestion'
import { BASIS_LEDGER_ROWS, basisDre } from '@/test/fixtures'

const SUMIFS = `IF($B$1="Competência",SUMIFS('Fluxo de Caixa'!$L:$L,'Fluxo de Caixa'!$D:$D,$A:$A),SUMIFS('Fluxo de Caixa'!$L:$L,'Fluxo de Caixa'!$P:$P,$B$2))`

describe('parseLineFormula', () => {
  it('reconhece as contas somadas do fluxo de caixa', () => {
    expect(parseLineFormula(SUMIFS, 2, true)).toEqual({ type: 'ledger' })
    expect(parseLineFormula('SOMASES(X:X;Y:Y;A5)', 2, true)).toEqual({ type: 'ledger' })
  })

  it('lê somas de intervalos e de referências com sinal', () => {
    expect(parseLineFormula('SUM(C6:C8)', 2, true)).toEqual({
      type: 'sum',
      constant: 0,
      terms: [5, 6, 7].map((row) => ({ row, sign: 1 })),
    })
    expect(parseLineFormula('=SUM(C141+C143)-$C$157+10', 2, true)).toEqual({
      type: 'sum',
      constant: 10,
      terms: [
        { row: 140, sign: 1 },
        { row: 142, sign: 1 },
        { row: 156, sign: -1 },
      ],
    })
    expect(parseLineFormula('-(D5-D6)', 3, true)).toMatchObject({ terms: [{ row: 4, sign: -1 }, { row: 5, sign: 1 }] })
  })

  it('mantém o valor digitado quando a fórmula foge do padrão', () => {
    expect(parseLineFormula('VLOOKUP(A1,B:C,2,0)', 2, true)).toEqual({ type: 'fixed' })
    expect(parseLineFormula('SUM(D5:D6)', 2, true)).toEqual({ type: 'fixed' })
    expect(parseLineFormula('', 2, true)).toEqual({ type: 'fixed' })
    expect(parseLineFormula(undefined, 2, false)).toEqual({ type: 'blank' })
  })

  it('converte o número da coluna em letras', () => {
    expect([0, 2, 25, 26, 38].map(columnLetters)).toEqual(['A', 'C', 'Z', 'AA', 'AM'])
  })
})

const dreTable = (selector?: string[]): RawTable => ({ sheet: 'DRE Geral', ...basisDre(selector) })
const ledger: RawTable = { sheet: 'Fluxo de Caixa', rows: BASIS_LEDGER_ROWS }

const APRIL = new Date(2026, 3, 1)
const valuesOf = (report: DreReport, label: string) => report.lines.find((line) => line.label === label)!.values

describe('DRE recalculada pelo regime e pelo banco', () => {
  const report = DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL })

  it('abre no regime e no banco escolhidos na planilha, com os mesmos valores', () => {
    expect(report.basis).toEqual({ regime: DreRegime.Cash, bank: 'BANCO A' })
    expect(report.canChangeBasis).toBe(true)
    expect(report.banks).toEqual(['BANCO A', 'BANCO B'])
    expect(valuesOf(report, 'RECEITA OPERACIONAL BRUTA')).toEqual([100, 30])
    expect(valuesOf(report, 'Saldo final')).toEqual([70, 30])
  })

  it('no caixa com todas as contas, soma os lançamentos de todos os bancos pelo pagamento', () => {
    const all = report.withBasis({ regime: DreRegime.Cash, bank: null })
    expect(all.name).toBe(report.name)
    expect(valuesOf(all, 'Vendas')).toEqual([100, 50])
    expect(valuesOf(all, 'RECEITA OPERACIONAL BRUTA')).toEqual([100, 80])
    expect(valuesOf(all, 'RESULTADO LÍQUIDO (EBITDA)')).toEqual([60, 80])
  })

  it('na competência, soma pela emissão, inclusive o que ainda não foi pago', () => {
    const accrual = report.withBasis({ regime: DreRegime.Accrual, bank: 'BANCO A' })
    expect(valuesOf(accrual, 'Vendas')).toEqual([150, 0])
    expect(valuesOf(accrual, 'Aluguel')).toEqual([-40, -40])
    expect(valuesOf(accrual, 'Saldo inicial')).toEqual([0, 0])
    expect(accrual.entriesOf(accrual.lines.find((line) => line.label === 'Aluguel')!, 1)).toHaveLength(1)
  })

  it('filtra os lançamentos do detalhe pelo banco', () => {
    const vendas = report.lines.find((line) => line.label === 'Vendas')!
    const bankB = report.withBasis({ regime: DreRegime.Cash, bank: 'banco b' })
    expect(report.entriesOf(vendas, 1)).toEqual([])
    expect(bankB.periods).toEqual([{ year: 2026, month: 2 }])
    expect(bankB.entriesOf(vendas, 0).map((entry) => entry.value)).toEqual([50])
  })

  it('zera a DRE, nos mesmos meses, para um banco sem lançamentos', () => {
    const empty = report.withBasis({ regime: DreRegime.Cash, bank: 'BANCO Z' })
    expect(empty.periods).toEqual(report.periods)
    expect(valuesOf(empty, 'RECEITA OPERACIONAL BRUTA')).toEqual([0, 0])
  })

  it('guarda o recálculo de cada regime', () => {
    const basis = { regime: DreRegime.Accrual, bank: null }
    expect(report.withBasis(basis)).toBe(report.withBasis(basis))
  })

  it('lê "Competência" e "Todas" nos seletores da planilha', () => {
    expect(DreReport.fromWorkbook([dreTable(['Competência', '']), ledger], { name: 'DRE', asOf: APRIL }).basis.regime).toBe(DreRegime.Accrual)
    expect(DreReport.fromWorkbook([dreTable(['Caixa', 'TODAS']), ledger], { name: 'DRE', asOf: APRIL }).basis).toEqual({ regime: 'cash', bank: null })
  })

  it('sem fórmulas ou sem lançamentos, mantém os valores da planilha', () => {
    const { formulas: _, ...withoutFormulas } = dreTable()
    const plain = DreReport.fromWorkbook([withoutFormulas, ledger], { name: 'DRE', asOf: APRIL })
    expect(plain.canChangeBasis).toBe(false)
    expect(plain.withBasis({ regime: DreRegime.Accrual, bank: null })).toBe(plain)
    expect(DreReport.fromWorkbook([dreTable()], { name: 'DRE', asOf: APRIL }).canChangeBasis).toBe(false)
  })
})

describe('lançamentos fora da DRE', () => {
  const rows = [
    [...BASIS_LEDGER_ROWS[0]!, 'CLASSIFICAÇÃO C.A'],
    ...BASIS_LEDGER_ROWS.slice(1).map((row) => [...row, '']),
    ['2026-02-03', '', '-25', '2026-02-04', 'BANCO A', 'Transferência de Saída'],
    ['2026-02-03', 'Servicos', '5', '2026-02-04', 'BANCO A', ''],
    ['2026-02-03', 'vendas', '7', '2026-02-04', 'BANCO A', ''],
    ['', 'Vendas', '9', '2026-02-06', 'BANCO A', ''],
  ]
  const report = DreReport.fromWorkbook([dreTable(), { sheet: 'Fluxo de Caixa', rows }], { name: 'DRE', asOf: APRIL })
  const february = [1]

  it('casa a categoria como o SOMASES: ignora maiúsculas, mas não acentos', () => {
    expect(valuesOf(report, 'Vendas')).toEqual([100, 16])
    expect(valuesOf(report, 'Serviços')).toEqual([0, 30])
  })

  it('aponta os sem categoria e os com categoria que não é conta da DRE', () => {
    expect(report.outsideEntries(february)).toEqual([
      { reason: 'no-category', label: 'Transferência de Saída', count: 1, total: -25 },
      { reason: 'unknown-category', label: 'Servicos', count: 1, total: 5 },
    ])
    expect(report.outsideEntries([0])).toEqual([])
  })

  it('na competência, aponta os pagos no período sem data de emissão', () => {
    const accrual = report.withBasis({ regime: DreRegime.Accrual, bank: null })
    expect(accrual.outsideEntries(february)).toEqual([
      { reason: 'no-category', label: 'Transferência de Saída', count: 1, total: -25 },
      { reason: 'no-issue-date', label: 'Sem data de emissão', count: 1, total: 9 },
      { reason: 'unknown-category', label: 'Servicos', count: 1, total: 5 },
    ])
  })

  it('respeita o banco escolhido', () => {
    expect(report.withBasis({ regime: DreRegime.Cash, bank: 'BANCO B' }).outsideEntries([0])).toEqual([])
  })

  it('não aponta nada quando a DRE não é recalculada', () => {
    expect(DreReport.fromWorkbook([dreTable()], { name: 'DRE', asOf: APRIL }).outsideEntries(february)).toEqual([])
  })
})

describe('linhas com valor digitado', () => {
  it('são apontadas, porque não mudam com o regime', () => {
    const table = dreTable()
    const formulas = new Map(table.formulas)
    const aluguel = table.rows.findIndex((row) => row[0] === 'Aluguel')
    formulas.delete(`${aluguel}:2`)
    const report = DreReport.fromWorkbook([{ ...table, formulas }, ledger], { name: 'DRE', asOf: APRIL })
    expect(report.staticLines).toEqual(['Aluguel'])
    expect(valuesOf(report.withBasis({ regime: DreRegime.Accrual, bank: null }), 'Aluguel')).toEqual([-40, -40])
    expect(DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL }).staticLines).toEqual([])
  })
})

describe('saldo de caixa', () => {
  const report = DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL })

  it('só existe no regime de caixa', () => {
    expect(report.hasCashBalance).toBe(true)
    expect(report.withBasis({ regime: DreRegime.Accrual, bank: null }).hasCashBalance).toBe(false)
  })
})

describe('linhas com valor digitado só em meses fora da análise', () => {
  it('não são apontadas', () => {
    const table = dreTable()
    const formulas = new Map(table.formulas)
    const vendas = table.rows.findIndex((row) => row[0] === 'Serviços')
    formulas.delete(`${vendas}:3`)
    const report = DreReport.fromWorkbook([{ ...table, formulas }, ledger], { name: 'DRE', asOf: new Date(2026, 1, 10) })
    expect(report.periods).toEqual([{ year: 2026, month: 1 }])
    expect(report.staticLines).toEqual([])
  })
})
