import { utils, write } from 'xlsx'
import { cellKey } from '@/domain/ingestion'

type DreLine = readonly [label: string, ...values: number[]] | null

const DRE_MONTHS = [
  [12, 2025],
  [1, 2026],
  [2, 2026],
  [3, 2026],
] as const

export const LEDGER_ROWS: string[][] = [
  ['DATA DE EMISSÃO', 'MOVIMENTAÇÃO', 'HISTÓRICO', 'CATEGORIA', 'VALOR', 'DATA PAGTO', 'UNIDADE'],
  ['2026-02-20', 'Saída', 'Folha de março, parte 1', 'Salários', '200', '2026-03-05', 'Matriz'],
  ['2026-02-20', 'Saída', 'Folha de março, parte 2', 'Salários', '150', '2026-03-20', 'Matriz'],
  ['2026-03-01', 'Saída', 'Aluguel da loja', 'Aluguel', '250', '2026-03-10', 'Matriz'],
  ['2026-03-02', 'Entrada', 'Vendas da semana', 'Produtos', '400', '2026-03-08', 'Matriz'],
  ['2026-03-09', 'Entrada', 'Vendas da semana', 'Produtos', '200', '2026-03-15', 'Matriz'],
  ['2026-03-09', 'Entrada', 'Consultoria', 'Serviços', '300', '2026-03-18', 'Matriz'],
  ['2026-03-25', 'Saída', 'Aluguel de abril, ainda não pago', 'Aluguel', '260', '', 'Matriz'],
  ['2026-01-20', 'Saída', 'Folha de fevereiro', 'Salários', '300', '2026-02-05', 'Matriz'],
]

export const DRE_LINES: readonly DreLine[] = [
  ['RECEITA OPERACIONAL BRUTA', 0, 1000, 1200, 900],
  ['Serviços', 0, 400, 500, 300],
  ['Produtos', 0, 600, 700, 600],
  null,
  ['IMPOSTOS SOBRE VENDA', 0, -100, -120, -90],
  ['Simples Nacional', 0, -100, -120, -90],
  null,
  ['CUSTOS DAS MERCADORIAS VENDIDAS', 0, -300, -350, -280],
  ['REPOSIÇÃO DE ESTOQUE', 0, -200, -250, -200],
  ['Compra de mercadoria', 0, -100, -100, -80],
  null,
  ['LUCRO OPERACIONAL BRUTO', 0, 600, 730, 530],
  null,
  ['OUTRAS DESPESAS VARIÁVEIS', 0, 0, 0, 0],
  ['Taxas de cartão', 0, 0, 0, 0],
  null,
  ['MARGEM DE CONTRIBUIÇÃO', 0, 600, 730, 530],
  null,
  ['DESPESAS OPERACIONAIS', 0, -500, -520, -600],
  ['DESPESAS COM PESSOAL', 0, -300, -300, -350],
  ['Salários', 0, -300, -300, -350],
  null,
  ['DESPESAS GERAIS', 0, -200, -220, -250],
  ['Aluguel', 0, -200, -220, -250],
  null,
  ['RESULTADO LÍQUIDO (EBITDA)', 0, 100, 210, -70],
  null,
  ['RESULTADO LÍQUIDO', 0, 100, 210, -70],
  null,
  ['Variação', 0, 100, 210, -70],
  ['Saldo inicial', 0, 50, 150, 360],
  ['Saldo final', 0, 150, 360, 290],
]

const DUPLICATED_MONTH_VALUE = 999_999

export function dreRows({ labelColumn = 0, lines = DRE_LINES } = {}): string[][] {
  const firstValueColumn = labelColumn + 2
  const columnOf = (monthIndex: number) => firstValueColumn + monthIndex * 3
  const duplicatedColumn = columnOf(DRE_MONTHS.length)
  const width = duplicatedColumn + 2
  const blank = () => Array<string>(width).fill('')

  const title = blank()
  title[labelColumn] = 'DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO'

  const monthRow = blank()
  const yearRow = blank()
  yearRow[labelColumn] = 'DESCRIÇÃO CONTAS'
  DRE_MONTHS.forEach(([month, year], i) => {
    monthRow[columnOf(i)] = String(month)
    monthRow[columnOf(i) + 1] = 'AV'
    yearRow[columnOf(i)] = String(year)
  })
  monthRow[duplicatedColumn] = '1'
  yearRow[duplicatedColumn] = '2026'

  const body = lines.map((line, index) => {
    const row = blank()
    if (!line) return row
    const [label, ...values] = line
    if (labelColumn > 0) row[0] = String(index + 1)
    row[labelColumn] = label
    values.forEach((value, i) => (row[columnOf(i)] = String(value)))
    row[duplicatedColumn] = String(DUPLICATED_MONTH_VALUE)
    return row
  })

  return [title, blank(), monthRow, yearRow, ...body]
}

export function xlsxFile(
  name: string,
  sheets: Record<string, string[][]>,
  formulas: Record<string, ReadonlyMap<string, string>> = {},
): File {
  const workbook = utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const cells = rows.map((row) => row.map((cell) => (cell !== '' && Number.isFinite(Number(cell)) ? Number(cell) : cell)))
    const sheet = utils.aoa_to_sheet(cells)
    for (const [key, formula] of formulas[sheetName] ?? []) {
      const [r, c] = key.split(':').map(Number) as [number, number]
      const address = utils.encode_cell({ r, c })
      sheet[address] = { ...(sheet[address] ?? { t: 'n', v: 0 }), f: formula }
    }
    utils.book_append_sheet(workbook, sheet, sheetName)
  }
  return new File([write(workbook, { type: 'array', bookType: 'xlsx' })], name)
}

const SUMIFS = `IF($B$1="Competência",SUMIFS('Fluxo de Caixa'!$L:$L,'Fluxo de Caixa'!$D:$D,$A:$A),SUMIFS('Fluxo de Caixa'!$L:$L,'Fluxo de Caixa'!$P:$P,$B$2))`

/**
 * Uma DRE no formato da Boat Lux: seletores "Caixa / BANCO A" no topo, contas somadas do fluxo de caixa
 * (SOMASES) e totais por fórmula. Os valores são os de Caixa / BANCO A.
 */
export function basisDre(selector = ['Caixa', 'BANCO A']): { rows: string[][]; formulas: Map<string, string> } {
  type Line = [label: string, jan: number, feb: number, formula: (col: string) => string]
  const lines: (Line | null)[] = [
    ['RECEITA OPERACIONAL BRUTA', 100, 30, (c) => `SUM(${c}6:${c}7)`],
    ['Vendas', 100, 0, () => SUMIFS],
    ['Serviços', 0, 30, () => SUMIFS],
    null,
    ['DESPESAS OPERACIONAIS', -40, 0, (c) => `SUM(${c}10:${c}10)`],
    ['Aluguel', -40, 0, () => SUMIFS],
    null,
    ['RESULTADO LÍQUIDO (EBITDA)', 60, 30, (c) => `${c}5+${c}9`],
    null,
    ['Saldo inicial', 10, 0, () => SUMIFS],
    ['Saldo final', 70, 30, (c) => `${c}14+${c}12`],
  ]
  const rows = [
    ['DRE', selector[0]!, '', ''],
    ['', selector[1]!, '', ''],
    ['', '', '1', '2'],
    ['DESCRIÇÃO', '', '2026', '2026'],
  ]
  const formulas = new Map<string, string>()
  for (const line of lines) {
    if (!line) {
      rows.push(['', '', '', ''])
      continue
    }
    const [label, jan, feb, formula] = line
    formulas.set(cellKey(rows.length, 2), formula('C'))
    formulas.set(cellKey(rows.length, 3), formula('D'))
    rows.push([label, '', String(jan), String(feb)])
  }
  return { rows, formulas }
}

export const BASIS_LEDGER_ROWS: string[][] = [
  ['DATA DE EMISSÃO', 'CATEGORIA', 'VALOR', 'DATA PAGTO', 'BANCO'],
  ['2026-01-10', 'Vendas', '100', '2026-01-15', 'BANCO A'],
  ['2026-01-20', 'Vendas', '50', '2026-02-05', 'BANCO B'],
  ['2026-02-01', 'Serviços', '30', '2026-02-10', 'BANCO A'],
  ['2026-01-01', 'Aluguel', '-40', '2026-01-05', 'BANCO A'],
  ['2026-02-01', 'Aluguel', '-40', '', ''],
  ['', 'Saldo inicial', '10', '2026-01-01', 'BANCO A'],
]

export const DEBT_ROWS: string[][] = [
  ['Última atualização: 01/10/2026', 'SALDO', '10/2026', '11/2026', '12/2026', '01/2027'],
  ['Empréstimo banco', 'R$ 3,000.00', '1000', '1000', '1000', ''],
  ['Financiamento lancha', '9000', '', '3000', '3000', '3000'],
  ['Quitada', '0', '', '', '', ''],
  ['TOTAL', '12000', '1000', '4000', '4000', '3000'],
  ['', '', '', '85000', '', ''],
]

export const STOCK_ROWS: string[][] = [
  ['Cotas disponíveis', 'Valor da cota', '10/2026', '', '', '', '', '', '', 'J12', '32000'],
  ['J12', 'R$ 12,000.00'],
  ['L29 - 01', '145000'],
  ['L29 - 02', '145000'],
  ['L31- 05', '129000'],
  ['L31 - 06', '114000'],
  ['', '545000'],
]

/** A planilha completa da Boat Lux: DRE com fórmulas, fluxo de caixa, dívidas e estoque. */
export function boatluxFile(): File {
  const dre = basisDre()
  return xlsxFile(
    'Fechamento 2026.xlsx',
    { 'Fluxo de Caixa': BASIS_LEDGER_ROWS, 'DRE Geral': dre.rows, 'Dívidas  ': DEBT_ROWS, Estoque: STOCK_ROWS },
    { 'DRE Geral': dre.formulas },
  )
}
