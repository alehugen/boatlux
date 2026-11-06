import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import type { Report } from '@/domain/report'
import { container } from '@/infrastructure/container'
import { useReports } from './useReports'

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

const useImportStore = defineStore('import', () => {
  const isImporting = ref(false)
  const errors = ref<string[]>([])
  const { refresh } = useReports()

  async function importFiles(files: readonly File[]): Promise<Report[]> {
    if (isImporting.value) return []
    isImporting.value = true
    errors.value = []
    const imported: Report[] = []

    for (const file of files) {
      try {
        imported.push(...(await container.importFile.execute(file)))
      } catch (error) {
        errors.value.push(errorMessage(error, `Erro inesperado ao importar ${file.name}`))
      }
    }

    await refresh()
    isImporting.value = false

    return imported
  }

  function clearErrors() {
    errors.value = []
  }

  return { isImporting, errors, importFiles, clearErrors }
})

export function useFileImport() {
  const store = useImportStore()
  return {
    ...storeToRefs(store),
    importFiles: store.importFiles,
    clearErrors: store.clearErrors,
  }
}
