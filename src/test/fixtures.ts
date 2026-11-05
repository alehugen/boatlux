import { utils, write } from 'xlsx'

type DreLine = readonly [label: string, ...values: number[]] | null

const DRE_MONTHS = [
  [12, 2025],
  [1, 2026],
  [2, 2026],
  [3, 2026],
] as const

export const LEDGER_ROWS: string[][] = [
  ['DATA DE EMISSÃO', 'MOVIMENTAÇÃO', 'HISTÓRICO', 'CLASSIFICAÇÃO', 'VALOR', 'DATA PAGTO', 'UNIDADE'],
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

export function xlsxFile(name: string, sheets: Record<string, string[][]>): File {
  const workbook = utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const cells = rows.map((row) => row.map((cell) => (cell !== '' && Number.isFinite(Number(cell)) ? Number(cell) : cell)))
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(cells), sheetName)
  }
  return new File([write(workbook, { type: 'array', bookType: 'xlsx' })], name)
}
