import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from '@/infrastructure/container'
import { useDreAnalysis } from '@/presentation/composables/useDreAnalysis'
import { useReport } from '@/presentation/composables/useReport'
import {
  finishPageLoading,
  pageEntering,
  pageLeaving,
  startPageLoading,
  usePageLoading,
} from '@/presentation/composables/usePageLoading'
import { useTweenedNumbers } from '@/presentation/composables/useTween'
import { boatluxFile, dreRows, xlsxFile, rsFile } from '@/test/fixtures'
import { createApp, defineComponent, nextTick, ref } from 'vue'

/** Roda um composable dentro de um componente montado (para hooks de ciclo de vida). */
function withSetup<T>(composable: () => T): T {
  let result!: T
  createApp(defineComponent({ setup: () => ((result = composable()), () => null) })).mount(document.createElement('div'))
  return result
}

beforeEach(() => setActivePinia(createPinia()))

afterEach(() => vi.restoreAllMocks())

describe('useReport', () => {
  it('abre a planilha importada e a substitui na próxima importação', async () => {
    const { importFile, report, error, isImporting } = useReport()
    const first = await importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))
    expect(report.value).toBe(first)
    expect(report.value?.name).toBe('DRE')

    await importFile(boatluxFile())
    expect(report.value?.name).toBe('Fechamento 2026')
    expect(error.value).toBeNull()
    expect(isImporting.value).toBe(false)
  })

  it('mantém a planilha aberta e mostra o erro quando a importação falha', async () => {
    const { importFile, report, error, clearError } = useReport()
    await importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))
    expect(await importFile(new File([], 'vazio.xlsx'))).toBeNull()
    expect(error.value).toBe('O arquivo está vazio: vazio.xlsx')
    expect(report.value?.name).toBe('DRE')
    clearError()
    expect(useReport().error.value).toBeNull()
  })

  it('ignora uma nova importação enquanto outra está em andamento', async () => {
    const { importFile, report } = useReport()
    const first = importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))
    expect(await importFile(boatluxFile())).toBeNull()
    await first
    expect(report.value?.name).toBe('DRE')
  })

  it('importa várias planilhas: cada uma na sua operação, com os erros de cada arquivo', async () => {
    const { importFiles, companies, activeId, error } = useReport()
    const imported = await importFiles([boatluxFile(), new File(['a;b'], 'tabela.csv'), rsFile()])
    expect(imported.map((r) => r.layout.id)).toEqual(['boatlux', 'rs-nautica'])
    expect(companies.value.map((c) => c.id)).toEqual(['boatlux', 'rs-nautica'])
    expect(activeId.value).toBe('boatlux')
    expect(error.value).toMatch(/^Formato não suportado: tabela.csv/)
  })

  it('avisa quando duas planilhas são da mesma operação e fica com a última', async () => {
    const { importFiles, report, error } = useReport()
    await importFiles([xlsxFile('Antiga.xlsx', { 'DRE Unidades': dreRows() }), boatluxFile()])
    expect(report.value?.name).toBe('Fechamento 2026')
    expect(error.value).toBe('Antiga.xlsx e Fechamento 2026.xlsx são da mesma operação (Boatlux): ficou Fechamento 2026.xlsx.')
  })

  it('explica erros inesperados', async () => {
    vi.spyOn(container.importFile, 'execute').mockRejectedValueOnce('falhou')
    await useReport().importFile(new File(['x'], 'DRE.xlsx'))
    expect(useReport().error.value).toBe('Erro inesperado ao importar DRE.xlsx')
  })
})

describe('useDreAnalysis', () => {
  it('começa pelo mês mais recente e permite trocar o período', async () => {
    await useReport().importFile(xlsxFile('DRE.xlsx', { 'DRE Unidades': dreRows() }))

    const { selections, selectedKey, analysis, periodLabels, insights } = useDreAnalysis()
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

  it('troca o regime e volta ao da planilha ao importar outra', async () => {
    await useReport().importFile(boatluxFile())
    const { basis, setBasis, report } = useDreAnalysis()
    expect(basis.value).toEqual({ regime: 'cash', unit: 'Repasse' })

    setBasis({ regime: 'accrual', unit: null })
    await nextTick()
    expect(report.value?.basis.regime).toBe('accrual')

    await useReport().importFile(boatluxFile())
    await nextTick()
    expect(basis.value).toEqual({ regime: 'cash', unit: 'Repasse' })
  })

  it('fica vazio sem planilha importada', () => {
    const { report, analysis } = useDreAnalysis()
    expect(report.value).toBeNull()
    expect(analysis.value).toBeNull()
  })
})

describe('useTweenedNumbers', () => {
  it('começa no valor atual e anima até o novo valor', async () => {
    const source = ref([10, 20])
    const tweened = withSetup(() => useTweenedNumbers(() => source.value, 50))
    expect(tweened.value).toEqual([10, 20])

    source.value = [110, 0]
    await nextTick()
    await vi.waitFor(() => expect(tweened.value).toEqual([110, 0]))
  })

  it('troca direto quando a quantidade de valores muda', async () => {
    const source = ref([1])
    const tweened = withSetup(() => useTweenedNumbers(() => source.value))
    source.value = [1, 2]
    await nextTick()
    expect(tweened.value).toEqual([1, 2])
  })
})

describe('usePageLoading', () => {
  it('mostra o indicador da faixa só entre a saída da página e a entrada da próxima', () => {
    const { busy, swapping } = usePageLoading()
    startPageLoading()
    expect([busy.value, swapping.value]).toEqual([true, false])
    pageLeaving()
    expect([busy.value, swapping.value]).toEqual([true, true])
    pageEntering()
    expect([busy.value, swapping.value]).toEqual([true, false])
    finishPageLoading()
    expect([busy.value, swapping.value]).toEqual([false, false])
  })
})
