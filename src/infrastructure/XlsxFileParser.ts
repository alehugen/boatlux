import { FileFormat, type FileParser, type RawTable, type SourceFile } from '@/domain/ingestion'

export class XlsxFileParser implements FileParser {
  readonly format = FileFormat.Xlsx

  async parse(file: SourceFile): Promise<RawTable[]> {
    const { read, utils } = await import('xlsx')
    const workbook = read(await file.content.arrayBuffer(), { cellDates: true })
    const hasMultipleSheets = workbook.SheetNames.length > 1

    return workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return []

      const rows = utils
        .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
        .map((row) => row.map(toCellText))

      if (!rows.some((row) => row.some(Boolean))) return []
      return [
        {
          name: hasMultipleSheets ? `${file.baseName} · ${sheetName.trim()}` : file.baseName,
          sheet: sheetName,
          rows,
        },
      ]
    })
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function toCellText(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  if (typeof value === 'number') return numberText(value)
  return String(value ?? '').trim()
}

function numberText(value: number): string {
  const text = String(value)
  return /^-?\d{1,3}\.\d{3}$/.test(text) ? `${text}0` : text
}
