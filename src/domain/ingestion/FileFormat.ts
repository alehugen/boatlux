export const FileFormat = {
  Xlsx: 'xlsx',
} as const

export type FileFormat = (typeof FileFormat)[keyof typeof FileFormat]

const EXTENSION_MAP: Record<string, FileFormat> = {
  xlsx: FileFormat.Xlsx,
  xls: FileFormat.Xlsx,
}

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_MAP).map((ext) => `.${ext}`)

export function detectFileFormat(fileName: string): FileFormat | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MAP[extension] ?? null
}
