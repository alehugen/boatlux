import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { DreLine, DreReport } from '@/domain/dre'
import { container } from '@/infrastructure/container'

export function useCellBreakdown(report: MaybeRefOrGetter<DreReport>) {
  const open = ref(false)
  const cell = ref<{ lineId: string; periodIndex: number } | null>(null)

  const breakdown = computed(() =>
    cell.value ? container.analyzeDre.breakdown(toValue(report), cell.value.lineId, cell.value.periodIndex) : null,
  )

  const canInspect = (line: DreLine) => toValue(report).isTraceable(line)

  function inspect(line: DreLine, periodIndex: number) {
    cell.value = { lineId: line.id, periodIndex }
    open.value = true
  }

  return { open, breakdown, canInspect, inspect }
}
