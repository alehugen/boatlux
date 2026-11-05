import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from '@/infrastructure/container'
import { useDreAnalysis } from '@/presentation/composables/useDreAnalysis'
import { useFileImport } from '@/presentation/composables/useFileImport'
import { useReports } from '@/presentation/composables/useReports'
import { dreRows, xlsxFile } from '@/test/fixtures'

async function clearReports() {
  for (const report of await container.listReports.execute()) await container.removeReport.execute(report.id)
}

beforeEach(async () => {
  setActivePinia(createPinia())
  await clearReports()
})

afterEach(() => vi.restoreAllMocks())

describe('useFileImport', () => {
  it('importa vários arquivos, junta os erros e atualiza a lista de relatórios', async () => {
    const { importFiles, errors, lastImported, isImporting } = useFileImport()
    const imported = await importFiles([
      xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() }),
      new File([], 'vazio.xlsx'),
      new File(['x'], 'foto.png'),
    ])

    expect(imported.map((report) => report.kind)).toEqual(['dre'])
    expect(lastImported.value).toEqual(imported)
    expect(errors.value).toEqual(['O arquivo está vazio: vazio.xlsx', 'Formato não suportado: foto.png'])
    expect(isImporting.value).toBe(false)
    expect(useReports().reports.value).toHaveLength(1)
  })

  it('ignora uma nova importação enquanto outra está em andamento', async () => {
    const { importFiles } = useFileImport()
    const first = importFiles([xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() })])
    const second = await importFiles([xlsxFile('DRE 2.xlsx', { 'DRE Geral': dreRows() })])
    await first

    expect(second).toEqual([])
    expect(useReports().reports.value).toHaveLength(1)
  })

  it('mostra um erro quando os arquivos não puderam ser preparados', async () => {
    const { importFiles, errors, isImporting } = useFileImport()
    await importFiles(Promise.reject(new Error('falha ao gerar')))
    expect(errors.value).toEqual(['falha ao gerar'])
    expect(isImporting.value).toBe(false)
  })

  it('compartilha o estado entre quem usa o composable', async () => {
    await useFileImport().importFiles([new File([], 'vazio.xlsx')])
    expect(useFileImport().errors.value).toHaveLength(1)
    useFileImport().dismissSummary()
    expect(useFileImport().lastImported.value).toEqual([])
  })
})

describe('useDreAnalysis', () => {
  it('começa pelo mês mais recente e permite trocar o período', async () => {
    const [report] = await container.importFile.execute(xlsxFile('DRE.xlsx', { 'DRE Geral': dreRows() }))
    await useReports().refresh()

    const { selections, selectedKey, analysis, periodLabels, insights } = useDreAnalysis(report!.id)
    expect(selections.value.map((s) => s.label)).toEqual(['mar/26', 'fev/26', 'jan/26', 'Acumulado 2026'])
    expect(periodLabels.value).toEqual({
      currentLong: 'março de 2026',
      previous: 'fev/26',
      reference: 'em mar/26',
      window: 'até mar/26',
      when: 'em mar/26',
      heading: 'Resultado de março de 2026',
    })
    expect(insights.value.length).toBeGreaterThan(0)

    selectedKey.value = 'y:2026'
    expect(analysis.value?.indexes).toEqual([0, 1, 2])
    expect(periodLabels.value.currentLong).toBe('acumulado de 2026')
    expect(periodLabels.value.reference).toBe('na média mensal de 2026')
    expect(periodLabels.value.when).toBe('no acumulado de 2026')
    expect(periodLabels.value.heading).toBe('Resultado acumulado de 2026')
  })

  it('não encontra uma DRE inexistente', () => {
    const { report, analysis } = useDreAnalysis('nao-existe')
    expect(report.value).toBeNull()
    expect(analysis.value).toBeNull()
  })
})
