import { defineStore, storeToRefs } from 'pinia'
import { shallowRef } from 'vue'
import type { Report } from '@/domain/report'
import type { Identifier } from '@/domain/shared'
import { container } from '@/infrastructure/container'

const useReportStore = defineStore('reports', () => {
  const reports = shallowRef<Report[]>([])

  async function refresh() {
    reports.value = await container.listReports.execute()
  }

  async function remove(id: Identifier) {
    await container.removeReport.execute(id)
    await refresh()
  }

  void refresh()

  return { reports, refresh, remove }
})

export function useReports() {
  const store = useReportStore()
  return { ...storeToRefs(store), refresh: store.refresh, remove: store.remove }
}
