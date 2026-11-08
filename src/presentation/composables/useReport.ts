import { defineStore, storeToRefs } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { DreReport } from '@/domain/dre'
import { container } from '@/infrastructure/container'

/** A planilha aberta. Importar outra substitui a anterior; nada sai do navegador. */
const useReportStore = defineStore('report', () => {
  const report = shallowRef<DreReport | null>(null)
  const isImporting = ref(false)
  const error = ref<string | null>(null)

  async function importFile(file: File): Promise<DreReport | null> {
    if (isImporting.value) return null
    isImporting.value = true
    error.value = null
    try {
      report.value = await container.importFile.execute(file)
      return report.value
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Erro inesperado ao importar ${file.name}`
      return null
    } finally {
      isImporting.value = false
    }
  }

  const clearError = () => (error.value = null)

  return { report, isImporting, error, importFile, clearError }
})

export function useReport() {
  const store = useReportStore()
  return { ...storeToRefs(store), importFile: store.importFile, clearError: store.clearError }
}
