<script setup lang="ts">
import { ref } from 'vue'
import { formatCurrencyWhole, prettifyLabel } from '@/presentation/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/presentation/components/ui/tooltip'

/** O que compõe uma parte da barra "De cada R$ 100": a conta, o valor no período e as linhas da DRE. */
export interface SliceDetail {
  title: string
  per100: string
  how: string
  amount: number
  parts: readonly { label: string; value: number }[]
  revenue: number
}

defineProps<{ detail: SliceDetail }>()

/** Abre também com toque e clique, para funcionar no celular. */
const open = ref(false)
</script>

<template>
  <Tooltip v-model:open="open" disable-closing-trigger>
    <TooltipTrigger as-child @click="open = !open">
      <slot />
    </TooltipTrigger>
    <TooltipContent side="top" :side-offset="8" class="block w-80 max-w-[calc(100vw-2rem)] p-0 text-left text-sm shadow-floating ring-1 ring-band-border">
      <div class="space-y-2 px-3.5 py-3">
        <p class="flex items-baseline justify-between gap-3">
          <span class="first-letter:uppercase">{{ detail.title }}</span>
          <span class="figure whitespace-nowrap">{{ detail.per100 }} de R$ 100</span>
        </p>
        <p class="text-xs leading-relaxed opacity-75">{{ detail.how }}</p>
      </div>
      <dl v-if="detail.parts.length" class="space-y-1 border-t border-background/15 px-3.5 py-2.5 text-xs">
        <div v-for="(part, i) in detail.parts" :key="i" class="flex justify-between gap-3">
          <dt class="min-w-0 truncate opacity-80">{{ prettifyLabel(part.label) }}</dt>
          <dd class="figure whitespace-nowrap">{{ formatCurrencyWhole(-part.value) }}</dd>
        </div>
      </dl>
      <p class="flex justify-between gap-3 border-t border-background/15 px-3.5 py-2.5 text-xs">
        <span class="opacity-80">No período, ÷ receita bruta de {{ formatCurrencyWhole(detail.revenue) }}</span>
        <span class="figure whitespace-nowrap">{{ formatCurrencyWhole(detail.amount) }}</span>
      </p>
    </TooltipContent>
  </Tooltip>
</template>
