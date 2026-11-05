import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { ProfitTargetBase } from '@/application'
import { container } from '@/infrastructure/container'

export const OPERATING_RESULT = 'Resultado operacional'

export const PROFIT_TARGETS = [10_000, 15_000, 20_000, 25_000, 50_000, 100_000] as const

export function useProfitTarget(base: MaybeRefOrGetter<ProfitTargetBase>) {
  const initial = PROFIT_TARGETS.find((target) => target > toValue(base).profit) ?? PROFIT_TARGETS.at(-1)!
  const target = ref<number>(initial)
  const projection = computed(() => container.analyzeDre.projectProfitTarget(toValue(base), target.value))
  return { target, projection }
}
