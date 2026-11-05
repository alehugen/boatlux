import { DomainError } from '@/domain/shared'
import { detectFileFormat, type FileFormat } from './FileFormat'

export const MAX_FILE_SIZE_MB = 25

export class SourceFile {
  readonly name: string
  readonly format: FileFormat
  readonly content: Blob

  private constructor(name: string, format: FileFormat, content: Blob) {
    this.name = name
    this.format = format
    this.content = content
  }

  static fromFile(file: File): SourceFile {
    const format = detectFileFormat(file.name)
    if (!format) throw new DomainError(`Formato não suportado: ${file.name}`)
    if (file.size === 0) throw new DomainError(`O arquivo está vazio: ${file.name}`)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new DomainError(`O arquivo ${file.name} passa do limite de ${MAX_FILE_SIZE_MB} MB.`)
    }
    return new SourceFile(file.name, format, file)
  }

  get baseName(): string {
    return this.name.replace(/\.[^.]+$/, '')
  }
}
