import { defineStore, storeToRefs } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Report } from '@/domain/report'
import { container } from '@/infrastructure/container'
import { useReports } from './useReports'

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

const useImportStore = defineStore('import', () => {
  const isImporting = ref(false)
  const errors = ref<string[]>([])
  const lastImported = shallowRef<Report[]>([])
  const { refresh } = useReports()

  async function importFiles(files: readonly File[] | Promise<readonly File[]>): Promise<Report[]> {
    if (isImporting.value) return []
    isImporting.value = true
    errors.value = []
    const imported: Report[] = []

    try {
      for (const file of await files) {
        try {
          imported.push(...(await container.importFile.execute(file)))
        } catch (error) {
          errors.value.push(errorMessage(error, `Erro inesperado ao importar ${file.name}`))
        }
      }
    } catch (error) {
      errors.value.push(errorMessage(error, 'Não foi possível preparar os arquivos.'))
    } finally {
      await refresh()
      isImporting.value = false
    }

    lastImported.value = imported
    return imported
  }

  function dismissSummary() {
    lastImported.value = []
  }

  function clearErrors() {
    errors.value = []
  }

  return { isImporting, errors, lastImported, importFiles, dismissSummary, clearErrors }
})

export function useFileImport() {
  const store = useImportStore()
  return {
    ...storeToRefs(store),
    importFiles: store.importFiles,
    dismissSummary: store.dismissSummary,
    clearErrors: store.clearErrors,
  }
}
