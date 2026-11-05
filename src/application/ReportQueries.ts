import type { Report, ReportRepository } from '@/domain/report'
import type { Identifier } from '@/domain/shared'

export class ListReportsUseCase {
  private readonly repository: ReportRepository

  constructor(repository: ReportRepository) {
    this.repository = repository
  }

  execute(): Promise<Report[]> {
    return this.repository.findAll()
  }
}

export class RemoveReportUseCase {
  private readonly repository: ReportRepository

  constructor(repository: ReportRepository) {
    this.repository = repository
  }

  execute(id: Identifier): Promise<void> {
    return this.repository.remove(id)
  }
}
