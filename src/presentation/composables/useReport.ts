import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { DRE_LAYOUTS, type CompanyId, type DreReport } from '@/domain/dre'
import { container } from '@/infrastructure/container'

/**
 * As planilhas abertas, uma por operação (Boatlux e RS Náutica), e qual está na tela. Importar uma planilha
 * substitui só a da mesma operação; nada sai do navegador.
 */
const useReportStore = defineStore('report', () => {
  const reports = shallowRef<Partial<Record<CompanyId, DreReport>>>({})
  const activeId = ref<CompanyId | null>(null)
  const isImporting = ref(false)
  const error = ref<string | null>(null)

  const report = computed(() => (activeId.value ? (reports.value[activeId.value] ?? null) : null))
  /** As operações com planilha aberta, na ordem dos modelos. */
  const companies = computed(() =>
    DRE_LAYOUTS.flatMap((layout) => {
      const opened = reports.value[layout.id]
      return opened ? [{ id: layout.id, company: layout.company, report: opened }] : []
    }),
  )

  async function importFile(file: File): Promise<DreReport | null> {
    if (isImporting.value) return null
    isImporting.value = true
    error.value = null
    try {
      const imported = await container.importFile.execute(file)
      reports.value = { ...reports.value, [imported.layout.id]: imported }
      activeId.value = imported.layout.id
      return imported
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Erro inesperado ao importar ${file.name}`
      return null
    } finally {
      isImporting.value = false
    }
  }

  const selectCompany = (id: CompanyId) => {
    if (reports.value[id]) activeId.value = id
  }
  const clearError = () => (error.value = null)

  return { report, companies, activeId, isImporting, error, importFile, selectCompany, clearError }
})

export function useReport() {
  const store = useReportStore()
  return {
    ...storeToRefs(store),
    importFile: store.importFile,
    selectCompany: store.selectCompany,
    clearError: store.clearError,
  }
}
