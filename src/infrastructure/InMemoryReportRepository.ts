import type { Report, ReportRepository } from '@/domain/report'
import type { Identifier } from '@/domain/shared'

export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<Identifier, Report>()

  async save(report: Report): Promise<void> {
    this.store.set(report.id, report)
  }

  async findAll(): Promise<Report[]> {
    return [...this.store.values()].sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())
  }

  async remove(id: Identifier): Promise<void> {
    this.store.delete(id)
  }
}
