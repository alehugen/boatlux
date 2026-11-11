import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { prefersReducedMotion } from '@/presentation/motion'

const easeOutQuint = (t: number) => 1 - (1 - t) ** 5


/**
 * Anima uma lista de números até os valores de `source` sempre que eles mudam.
 * Respeita o movimento reduzido do sistema: nesse caso, troca direto.
 */
export function useTweenedNumbers(source: () => readonly number[], duration = 750): Ref<number[]> {
  const current = ref<number[]>([...source()])
  let frame = 0

  watch(source, (target) => {
    cancelAnimationFrame(frame)
    const from = [...current.value]
    if (prefersReducedMotion() || from.length !== target.length) {
      current.value = [...target]
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = easeOutQuint(progress)
      current.value = target.map((value, i) => from[i]! + (value - from[i]!) * eased)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return current
}
