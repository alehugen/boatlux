<script setup lang="ts">
import type { Insight, InsightTone } from '@/domain/analysis'
import InfoTip from './InfoTip.vue'

defineProps<{ insights: readonly Insight[] }>()

const TONES: Record<InsightTone, { label: string; marker: string }> = {
  positive: { label: 'Ponto positivo', marker: 'bg-success' },
  negative: { label: 'Ponto de atenção', marker: 'bg-destructive' },
  neutral: { label: 'Observação', marker: 'border-2 border-primary' },
}
</script>

<template>
  <ul class="grid gap-4 lg:grid-cols-2">
    <li
      v-for="insight in insights"
      :key="insight.title"
      class="surface flex gap-3.5 p-5"
    >
      <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :class="TONES[insight.tone].marker" :title="TONES[insight.tone].label">
        <span class="sr-only">{{ TONES[insight.tone].label }}</span>
      </span>
      <p class="min-w-0 flex-1 leading-relaxed text-body">
        <span class="text-foreground">{{ insight.title }}.</span>
        {{ insight.description }}
      </p>
      <InfoTip :text="insight.explanation" class="-mt-0.5 -mr-2 shrink-0" />
    </li>
  </ul>
</template>
