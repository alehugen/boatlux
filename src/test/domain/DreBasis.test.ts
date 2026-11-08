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

const dreTable = (selector?: string[]): RawTable => ({ sheet: 'DRE Unidades', ...basisDre(selector) })
const ledger: RawTable = { sheet: 'Fluxo de Caixa', rows: BASIS_LEDGER_ROWS }

const APRIL = new Date(2026, 3, 1)
const valuesOf = (report: DreReport, label: string) => report.lines.find((line) => line.label === label)!.values

describe('DRE recalculada pelo regime e pelo banco', () => {
  const report = DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL })

  it('abre no regime e no banco escolhidos na planilha, com os mesmos valores', () => {
    expect(report.basis).toEqual({ regime: DreRegime.Cash, unit: 'Repasse' })
    expect(report.canChangeBasis).toBe(true)
    expect(report.units).toEqual(['Comercial', 'Repasse'])
    expect(valuesOf(report, 'RECEITA OPERACIONAL BRUTA')).toEqual([100, 30])
    expect(valuesOf(report, 'Saldo final')).toEqual([70, 30])
  })

  it('com todas as unidades, soma os lançamentos de todas pelo pagamento', () => {
    const all = report.withBasis({ regime: DreRegime.Cash, unit: null })
    expect(all.name).toBe(report.name)
    expect(valuesOf(all, 'Vendas')).toEqual([100, 50])
    expect(valuesOf(all, 'RECEITA OPERACIONAL BRUTA')).toEqual([100, 80])
    expect(valuesOf(all, 'RESULTADO LÍQUIDO (EBITDA)')).toEqual([60, 80])
  })

  it('na competência, soma pela emissão, inclusive o que ainda não foi pago', () => {
    const accrual = report.withBasis({ regime: DreRegime.Accrual, unit: null })
    expect(valuesOf(accrual, 'Vendas')).toEqual([150, 0])
    expect(valuesOf(accrual, 'Aluguel')).toEqual([-40, -40])
    expect(valuesOf(accrual, 'Saldo inicial')).toEqual([0, 0])
    expect(accrual.entriesOf(accrual.lines.find((line) => line.label === 'Aluguel')!, 1)).toHaveLength(1)
  })

  it('a unidade filtra nos dois regimes, como na planilha', () => {
    const repasse = report.withBasis({ regime: DreRegime.Accrual, unit: 'Repasse' })
    expect(valuesOf(repasse, 'Vendas')).toEqual([100, 0])
    expect(valuesOf(repasse, 'Aluguel')).toEqual([-40, 0])
  })

  it('filtra os lançamentos do detalhe pelo banco', () => {
    const vendas = report.lines.find((line) => line.label === 'Vendas')!
    const comercial = report.withBasis({ regime: DreRegime.Cash, unit: 'comercial' })
    expect(report.entriesOf(vendas, 1)).toEqual([])
    expect(comercial.periods).toEqual([{ year: 2026, month: 2 }])
    expect(comercial.entriesOf(vendas, 0).map((entry) => entry.value)).toEqual([50])
  })

  it('zera a DRE, nos mesmos meses, para um banco sem lançamentos', () => {
    const empty = report.withBasis({ regime: DreRegime.Cash, unit: 'Inexistente' })
    expect(empty.periods).toEqual(report.periods)
    expect(valuesOf(empty, 'RECEITA OPERACIONAL BRUTA')).toEqual([0, 0])
  })

  it('guarda o recálculo de cada regime', () => {
    const basis = { regime: DreRegime.Accrual, unit: null }
    expect(report.withBasis(basis)).toBe(report.withBasis(basis))
  })

  it('lê "Competência" e "Todas" nos seletores da planilha', () => {
    expect(DreReport.fromWorkbook([dreTable(['Competência', '']), ledger], { name: 'DRE', asOf: APRIL }).basis.regime).toBe(DreRegime.Accrual)
    expect(DreReport.fromWorkbook([dreTable(['Caixa', 'TODAS']), ledger], { name: 'DRE', asOf: APRIL }).basis).toEqual({ regime: 'cash', unit: null })
  })

  it('sem fórmulas ou sem lançamentos, mantém os valores da planilha', () => {
    const { formulas: _, ...withoutFormulas } = dreTable()
    const plain = DreReport.fromWorkbook([withoutFormulas, ledger], { name: 'DRE', asOf: APRIL })
    expect(plain.canChangeBasis).toBe(false)
    expect(plain.withBasis({ regime: DreRegime.Accrual, unit: null })).toBe(plain)
    expect(DreReport.fromWorkbook([dreTable()], { name: 'DRE', asOf: APRIL }).canChangeBasis).toBe(false)
  })
})

describe('lançamentos fora da DRE', () => {
  const rows = [
    [...BASIS_LEDGER_ROWS[0]!, 'CLASSIFICAÇÃO C.A'],
    ...BASIS_LEDGER_ROWS.slice(1).map((row) => [...row, '']),
    ['2026-02-03', '', '-25', '2026-02-04', 'Repasse', 'Transferência de Saída'],
    ['2026-02-03', 'Servicos', '5', '2026-02-04', 'Repasse', ''],
    ['2026-02-03', 'vendas', '7', '2026-02-04', 'Repasse', ''],
    ['', 'Vendas', '9', '2026-02-06', 'Repasse', ''],
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
    const accrual = report.withBasis({ regime: DreRegime.Accrual, unit: null })
    expect(accrual.outsideEntries(february)).toEqual([
      { reason: 'no-category', label: 'Transferência de Saída', count: 1, total: -25 },
      { reason: 'no-issue-date', label: 'Sem data de emissão', count: 1, total: 9 },
      { reason: 'unknown-category', label: 'Servicos', count: 1, total: 5 },
    ])
  })

  it('respeita o banco escolhido', () => {
    expect(report.withBasis({ regime: DreRegime.Cash, unit: 'Comercial' }).outsideEntries([0])).toEqual([])
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
    expect(valuesOf(report.withBasis({ regime: DreRegime.Accrual, unit: null }), 'Aluguel')).toEqual([-40, -40])
    expect(DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL }).staticLines).toEqual([])
  })
})

describe('saldo de caixa', () => {
  const report = DreReport.fromWorkbook([dreTable(), ledger], { name: 'DRE', asOf: APRIL })

  it('só existe no regime de caixa e com todas as unidades', () => {
    expect(report.withBasis({ regime: DreRegime.Cash, unit: null }).hasCashBalance).toBe(true)
    expect(report.withBasis({ regime: DreRegime.Accrual, unit: null }).hasCashBalance).toBe(false)
    // O saldo inicial é da empresa toda: numa unidade, não há saldo de caixa para mostrar.
    expect(report.hasCashBalance).toBe(false)
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

describe('DRE Unidades: unidades e lançamentos fora da DRE', () => {
  const rows = [
    ['DATA DE EMISSÃO', 'CATEGORIA', 'VALOR', 'DATA PAGTO', 'UNIDADE', 'CLASSIFICAÇÃO C.A'],
    ['2026-02-01', 'Vendas', '10', '2026-02-02', 'Repasse', ''],
    ['2026-02-01', 'Vendas', '20', '2026-02-02', 'Comercial', ''],
    ['2026-02-01', 'Vendas', '30', '2026-02-02', '', 'OUTRAS RECEITAS'],
    ['2026-02-01', '', '-40', '2026-02-02', '', 'Transferência de Saída'],
    ['2026-02-01', 'Inexistente', '-5', '2026-02-02', 'Comercial', ''],
    ['', 'Saldo inicial', '999', '2026-02-01', '', ''],
  ]
  const report = DreReport.fromWorkbook([dreTable(['Caixa', 'Repasse']), { sheet: 'Fluxo de Caixa', rows }], { name: 'DRE', asOf: APRIL })
  const february = report.periods.findIndex((period) => period.month === 2)

  it('numa unidade, aponta os sem unidade e os sem categoria, e ignora os de outras unidades e o saldo inicial', () => {
    expect(report.outsideEntries([february])).toEqual([
      { reason: 'no-category', label: 'Transferência de Saída', count: 1, total: -40 },
      { reason: 'no-unit', label: 'Vendas', count: 1, total: 30 },
    ])
  })

  it('com todas as unidades, os sem unidade entram na DRE', () => {
    const all = report.withBasis({ regime: DreRegime.Cash, unit: null })
    expect(valuesOf(all, 'Vendas')[february]).toBe(60)
    expect(all.outsideEntries([february])).toEqual([
      { reason: 'no-category', label: 'Transferência de Saída', count: 1, total: -40 },
      { reason: 'unknown-category', label: 'Inexistente', count: 1, total: -5 },
    ])
  })

  it('lê a competência da planilha mantendo a unidade de baixo', () => {
    const accrual = DreReport.fromWorkbook([dreTable(['Competência', 'Comercial']), { sheet: 'Fluxo de Caixa', rows }], {
      name: 'DRE',
      asOf: APRIL,
    })
    expect(accrual.basis).toEqual({ regime: DreRegime.Accrual, unit: 'Comercial' })
  })
})

describe('estrutura da DRE Unidades', () => {
  const rows = [
    ['', 'Caixa', ''],
    ['', 'Repasse', ''],
    ['', '', '1', '2'],
    ['DESCRIÇÃO', '', '2026', '2026'],
    ['SUSPENSO DE SECURITIZAÇÃO', '', '-10', '-20'],
    ['RECEITA', '', '5', '5'],
    ['SALDO', '', '-5', '-15'],
    ['', '', '', ''],
    ['RECEITA OPERACIONAL BRUTA', '', '100', '200'],
    ['Repasse', '', '100', '200'],
    ['', '', '', ''],
    ['SALDO FINAL', '', '100', '200'],
  ]
  const report = DreReport.fromTable({ sheet: 'DRE Unidades', rows }, APRIL)!

  it('lê o quadro com total na última linha como linhas simples', () => {
    expect(report.lines.slice(0, 3).map((line) => [line.label, line.kind, line.parentId])).toEqual([
      ['SUSPENSO DE SECURITIZAÇÃO', 'balance', null],
      ['RECEITA', 'balance', null],
      ['SALDO', 'balance', null],
    ])
    expect(report.lines.find((line) => line.label === 'RECEITA OPERACIONAL BRUTA')?.kind).toBe('group')
  })

  it('sem "Saldo inicial", o "Saldo final" é o resultado do mês: soma no acumulado e não vira saldo de caixa', () => {
    const final = report.lines.find((line) => line.label === 'SALDO FINAL')!
    expect(final.aggregation).toBe('sum')
    expect(report.valueOf(final, [0, 1])).toBe(300)
    expect(report.hasCashBalance).toBe(false)
  })
})

describe('quadro com total só em alguns meses', () => {
  it('continua sendo lido como linhas simples', () => {
    const rows = [
      ['', '1', '2', '3'],
      ['DESCRIÇÃO', '2026', '2026', '2026'],
      ['SUSPENSO DE SECURITIZAÇÃO', '-10', '-20', '-5'],
      ['RECEITA', '5', '0', '0'],
      ['SALDO', '-5', '', ''],
      ['', '', '', ''],
      ['RECEITA OPERACIONAL BRUTA', '100', '200', '300'],
      ['Repasse', '100', '200', '300'],
    ]
    const report = DreReport.fromTable({ sheet: 'DRE Unidades', rows }, APRIL)!
    expect(report.lines.slice(0, 3).map((line) => line.kind)).toEqual(['balance', 'balance', 'balance'])
  })
})

describe('revisão: motivos e unidades', () => {
  const rows = [
    ['DATA DE EMISSÃO', 'CATEGORIA', 'VALOR', 'DATA PAGTO', 'UNIDADE', 'CLASSIFICAÇÃO C.A'],
    ['2026-02-01', 'Vendas', '10', '2026-02-02', 'Repasse', ''],
    ['2026-02-01', 'Vendas', '1', '2026-02-02', 'REPASSE ', ''],
    ['2026-02-01', 'Inexistente', '-5', '2026-02-02', '', ''],
    ['', 'Vendas', '7', '2026-02-03', '', ''],
    ['2026-02-01', 'Saldo de aplicação', '3', '2026-02-02', 'Repasse', ''],
  ]
  const report = DreReport.fromWorkbook([dreTable(['Caixa', 'Repasse']), { sheet: 'Fluxo de Caixa', rows }], { name: 'DRE', asOf: APRIL })
  const february = report.periods.findIndex((period) => period.month === 2)
  const reasons = (view: DreReport) => view.outsideEntries([february]).map((group) => `${group.reason}: ${group.label}`)

  it('não repete a mesma unidade escrita de jeitos diferentes', () => {
    expect(report.units).toEqual(['Repasse'])
    expect(valuesOf(report, 'Vendas')[february]).toBe(11)
  })

  it('aponta a categoria fora da DRE antes da falta de unidade', () => {
    expect(reasons(report)).toContain('unknown-category: Inexistente')
    expect(reasons(report)).not.toContain('no-unit: Inexistente')
  })

  it('só ignora o saldo inicial: outras categorias de saldo sem conta na DRE são apontadas', () => {
    expect(reasons(report)).toContain('unknown-category: Saldo de aplicação')
  })

  it('na competência com unidade, sem unidade e sem emissão aponta a unidade', () => {
    const accrual = report.withBasis({ regime: DreRegime.Accrual, unit: 'Repasse' })
    expect(reasons(accrual)).toContain('no-unit: Vendas')
    expect(reasons(accrual)).not.toContain('no-issue-date: Sem data de emissão')
  })
})

describe('revisão: estrutura', () => {
  const parse = (lines: [string, number, number][]) => {
    const rows = [['', '1', '2'], ['DESCRIÇÃO', '2026', '2026'], ...lines.map(([label, a, b]) => (label ? [label, String(a), String(b)] : ['', '', '']))]
    return DreReport.fromTable({ sheet: 'DRE Unidades', rows }, APRIL)!
  }

  it('não achata seção com cabeçalho zerado só porque a última conta "fecha" a soma', () => {
    const report = parse([
      ['RECEITA OPERACIONAL BRUTA', 100, 100],
      ['Vendas', 100, 100],
      ['', 0, 0],
      ['DESPESAS FINANCEIRAS', 0, 0],
      ['TARIFAS', -50, -50],
      ['Tarifas bancárias', -50, -50],
    ])
    expect(report.lines.find((line) => line.label === 'Tarifas bancárias')?.kind).toBe('account')
  })

  it('só trata como saldo o "Saldo inicial" e o "Saldo final" exatos', () => {
    const report = parse([
      ['RECEITA OPERACIONAL BRUTA', 100, 100],
      ['Vendas', 100, 100],
      ['', 0, 0],
      ['Saldo inicial', 10, 110],
      ['Saldo inicial (caixa)', 10, 110],
      ['Saldo final', 110, 210],
    ])
    const aggregation = (label: string) => report.lines.find((line) => line.label === label)!.aggregation
    expect([aggregation('Saldo inicial'), aggregation('Saldo inicial (caixa)'), aggregation('Saldo final')]).toEqual(['first', 'sum', 'last'])
  })
})
