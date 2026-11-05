<script setup lang="ts">
import { PhLightbulb, PhTrendDown, PhTrendUp } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import type { Insight, InsightTone } from '@/domain/analysis'
import InfoTip from './InfoTip.vue'

defineProps<{ insights: readonly Insight[] }>()

const TONES: Record<InsightTone, { icon: Component; label: string; classes: string }> = {
  positive: { icon: PhTrendUp, label: 'Ponto positivo', classes: 'bg-success-soft text-success' },
  negative: { icon: PhTrendDown, label: 'Ponto de atenção', classes: 'bg-destructive-soft text-destructive' },
  neutral: { icon: PhLightbulb, label: 'Observação', classes: 'bg-accent text-accent-foreground' },
}
</script>

<template>
  <ul class="grid gap-3 lg:grid-cols-2">
    <li
      v-for="insight in insights"
      :key="insight.title"
      class="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <span
        class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
        :class="TONES[insight.tone].classes"
        :title="TONES[insight.tone].label"
      >
        <component :is="TONES[insight.tone].icon" :size="18" weight="bold" aria-hidden="true" />
        <span class="sr-only">{{ TONES[insight.tone].label }}</span>
      </span>
      <div class="min-w-0 flex-1">
        <p class="leading-snug font-semibold">{{ insight.title }}</p>
        <p class="mt-1 text-sm leading-relaxed text-body">{{ insight.description }}</p>
      </div>
      <InfoTip :text="insight.explanation" class="-mt-1 -mr-2 shrink-0" />
    </li>
  </ul>
</template>
