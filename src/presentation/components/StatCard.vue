<script setup lang="ts">
import { PhArrowDownRight, PhArrowUpRight, PhMinus } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { formatSignedPercent, formatSignedPoints } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    delta?: number | null
    deltaLabel?: string
    deltaUnit?: 'relative' | 'points'
    lowerIsBetter?: boolean
    info?: string
  }>(),
  { hint: undefined, delta: null, deltaLabel: undefined, deltaUnit: 'relative', lowerIsBetter: false, info: undefined },
)

const tone = computed(() => {
  if (props.delta === null || props.delta === 0) return 'neutral'
  return props.delta > 0 !== props.lowerIsBetter ? 'good' : 'bad'
})

const TONE_CLASSES = {
  good: 'text-success',
  bad: 'text-destructive',
  neutral: 'text-muted-foreground',
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-card">
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm text-muted-foreground">{{ label }}</p>
      <InfoTip v-if="info" :text="info" class="-mt-1 -mr-2 shrink-0" />
    </div>
    <p class="figure text-3xl leading-tight font-semibold text-foreground">{{ value }}</p>
    <p v-if="hint" class="text-sm text-body">{{ hint }}</p>
    <p v-if="delta !== null && Number.isFinite(delta)" class="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-sm">
      <span class="inline-flex items-center gap-0.5 font-medium figure" :class="TONE_CLASSES[tone]">
        <PhArrowUpRight v-if="delta > 0" weight="bold" aria-hidden="true" />
        <PhArrowDownRight v-else-if="delta < 0" weight="bold" aria-hidden="true" />
        <PhMinus v-else weight="bold" aria-hidden="true" />
        {{ deltaUnit === 'points' ? formatSignedPoints(delta) : formatSignedPercent(delta) }}
      </span>
      <span v-if="deltaLabel" class="text-muted-foreground">vs {{ deltaLabel }}</span>
    </p>
  </div>
</template>
