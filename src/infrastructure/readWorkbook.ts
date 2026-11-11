import { read, utils, type WorkSheet } from 'xlsx'
import { cellKey, type RawTable } from '@/domain/ingestion'

/** Lê as abas do arquivo com os valores como texto e as fórmulas de cada célula. Roda no worker ou, sem ele, na página. */
export function readWorkbook(content: ArrayBuffer): RawTable[] {
  const workbook = read(content, { cellDates: true, cellFormula: true })

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return []

    const range = usedRange(sheet)
    if (!range) return []
    const rows = utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true, range })
      .map((row) => row.map(toCellText))

    if (!rows.some((row) => row.some(Boolean))) return []
    return [{ sheet: sheetName, rows, formulas: formulasOf(sheet) }]
  })
}

const cellAddresses = (sheet: WorkSheet) => Object.keys(sheet).filter((address) => !address.startsWith('!'))

/**
 * De A1 até a última célula preenchida. Começa sempre em A1 para linhas e colunas baterem com as referências
 * das fórmulas (C5 é a linha 4, coluna 2), mesmo quando a planilha começa mais abaixo. E termina na última
 * célula de verdade, não no "!ref" do arquivo, que formatação em linhas vazias pode inflar até a linha 1 milhão.
 */
function usedRange(sheet: WorkSheet) {
  const addresses = cellAddresses(sheet)
  if (!addresses.length) return null
  const end = { r: 0, c: 0 }
  for (const address of addresses) {
    const { r, c } = utils.decode_cell(address)
    end.r = Math.max(end.r, r)
    end.c = Math.max(end.c, c)
  }
  return { s: { r: 0, c: 0 }, e: end }
}

/** Fórmulas por célula, nas mesmas posições de `rows` (a partir de A1). */
function formulasOf(sheet: WorkSheet): Map<string, string> {
  const formulas = new Map<string, string>()
  for (const address of cellAddresses(sheet)) {
    const formula = sheet[address]?.f
    if (!formula) continue
    const { r, c } = utils.decode_cell(address)
    formulas.set(cellKey(r, c), String(formula))
  }
  return formulas
}

const pad = (n: number) => String(n).padStart(2, '0')

function toCellText(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  if (typeof value === 'number') return numberText(value)
  return String(value ?? '').trim()
}

/** "1.234" vira "1.2340" para não ser lido como milhar no padrão brasileiro. */
function numberText(value: number): string {
  const text = String(value)
  return /^-?\d{1,3}\.\d{3}$/.test(text) ? `${text}0` : text
}
