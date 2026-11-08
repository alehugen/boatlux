import { read, utils, type WorkSheet } from 'xlsx'
import { cellKey, type RawTable } from '@/domain/ingestion'

/** Lê as abas do arquivo com os valores como texto e as fórmulas de cada célula. Roda no worker ou, sem ele, na página. */
export function readWorkbook(content: ArrayBuffer): RawTable[] {
  const workbook = read(content, { cellDates: true, cellFormula: true })

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return []

    const rows = utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
      .map((row) => row.map(toCellText))

    if (!rows.some((row) => row.some(Boolean))) return []
    return [{ sheet: sheetName, rows, formulas: formulasOf(sheet) }]
  })
}

/** Fórmulas por célula, nas posições relativas ao início da área usada (as mesmas de `rows`). */
function formulasOf(sheet: WorkSheet): Map<string, string> {
  const formulas = new Map<string, string>()
  const ref = sheet['!ref']
  if (!ref) return formulas
  const start = utils.decode_range(ref).s
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!') || !cell?.f) continue
    const { r, c } = utils.decode_cell(address)
    formulas.set(cellKey(r - start.r, c - start.c), String(cell.f))
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
