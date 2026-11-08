import { DomainError } from '@/domain/shared'

export const MAX_FILE_SIZE_MB = 25
export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls']

/** O arquivo escolhido para importar, já validado. */
export class SourceFile {
  readonly name: string
  readonly content: Blob

  private constructor(name: string, content: Blob) {
    this.name = name
    this.content = content
  }

  static fromFile(file: File): SourceFile {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new DomainError(`Formato não suportado: ${file.name}. Importe a planilha em ${SUPPORTED_EXTENSIONS.join(' ou ')}.`)
    }
    if (file.size === 0) throw new DomainError(`O arquivo está vazio: ${file.name}`)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new DomainError(`O arquivo ${file.name} passa do limite de ${MAX_FILE_SIZE_MB} MB.`)
    }
    return new SourceFile(file.name, file)
  }

  get baseName(): string {
    return this.name.replace(/\.[^.]+$/, '')
  }
}
