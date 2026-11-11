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

  /**
   * Importa uma ou mais planilhas, uma de cada vez: cada uma vai para a sua operação, e um arquivo com erro não
   * impede os outros. Duas da mesma operação: fica a última, com um aviso. A operação na tela passa a ser a da
   * primeira planilha importada. Devolve as planilhas importadas, na ordem dos arquivos.
   */
  async function importFiles(files: readonly File[]): Promise<DreReport[]> {
    if (isImporting.value || !files.length) return []
    isImporting.value = true
    error.value = null
    const problems: string[] = []
    const imported: { file: File; report: DreReport }[] = []
    try {
      for (const file of files) {
        try {
          const report = await container.importFile.execute(file)
          const twin = imported.find((item) => item.report.layout.id === report.layout.id)
          if (twin) {
            problems.push(`${twin.file.name} e ${file.name} são da mesma operação (${report.layout.company}): ficou ${file.name}.`)
          }
          imported.push({ file, report })
          reports.value = { ...reports.value, [report.layout.id]: report }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : `Erro inesperado ao importar ${file.name}`
          // Com vários arquivos, diz de qual é cada erro (a mensagem pode já citar o nome).
          problems.push(files.length > 1 && !message.includes(file.name) ? `${file.name}: ${message}` : message)
        }
      }
      if (imported[0]) activeId.value = imported[0].report.layout.id
      error.value = problems.length ? problems.join('\n') : null
      return imported.map((item) => item.report)
    } finally {
      isImporting.value = false
    }
  }

  async function importFile(file: File): Promise<DreReport | null> {
    return (await importFiles([file]))[0] ?? null
  }

  const selectCompany = (id: CompanyId) => {
    if (reports.value[id]) activeId.value = id
  }
  const clearError = () => (error.value = null)

  return { report, companies, activeId, isImporting, error, importFile, importFiles, selectCompany, clearError }
})

export function useReport() {
  const store = useReportStore()
  return {
    ...storeToRefs(store),
    importFile: store.importFile,
    importFiles: store.importFiles,
    selectCompany: store.selectCompany,
    clearError: store.clearError,
  }
}
