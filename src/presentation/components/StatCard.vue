<script setup lang="ts">
import { PhArrowDownRight, PhArrowUpRight, PhMinus } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { formatSignedPercent } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    negative?: boolean
    hint?: string
    delta?: number | null
    deltaLabel?: string
    info?: string
  }>(),
  {
    negative: false,
    hint: undefined,
    delta: null,
    deltaLabel: undefined,
    info: undefined,
  },
)

const tone = computed(() => {
  if (props.delta === null || props.delta === 0) return 'neutral'
  return props.delta > 0 ? 'good' : 'bad'
})

const TONE_CLASSES = {
  good: 'bg-success-soft text-success',
  bad: 'bg-destructive-soft text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}
</script>

<template>
  <div class="surface @container flex min-w-0 flex-col p-5">
    <div class="flex min-h-10 items-start justify-between gap-2">
      <p class="text-sm leading-snug text-muted-foreground">{{ label }}</p>
      <InfoTip v-if="info" :text="info" class="-mt-1 -mr-2 shrink-0" />
    </div>
    <p class="mt-1 text-[clamp(1.25rem,14cqi,1.75rem)] leading-tight whitespace-nowrap figure" :class="negative ? 'text-destructive' : 'text-foreground'">
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-sm text-body">{{ hint }}</p>
    <p v-if="delta !== null && Number.isFinite(delta)" class="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-sm">
      <span class="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 figure" :class="TONE_CLASSES[tone]">
        <PhArrowUpRight v-if="delta > 0" weight="bold" aria-hidden="true" />
        <PhArrowDownRight v-else-if="delta < 0" weight="bold" aria-hidden="true" />
        <PhMinus v-else weight="bold" aria-hidden="true" />
        {{ formatSignedPercent(delta) }}
      </span>
      <span v-if="deltaLabel" class="text-muted-foreground">vs {{ deltaLabel }}</span>
    </p>
  </div>
</template>
