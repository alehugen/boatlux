<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrencyWhole, formatNumberWhole, formatPercent } from '@/presentation/format'

export interface StatementLine {
  label: string
  value: number
  kind: 'start' | 'step' | 'total'
}

const props = defineProps<{ lines: readonly StatementLine[]; caption: string; issuer: string }>()

const items = computed(() => props.lines.slice(0, -1))
const result = computed(() => props.lines.at(-1))
const margin = computed(() => {
  const revenue = props.lines[0]?.value ?? 0
  return revenue && result.value ? result.value.value / revenue : null
})
const positive = computed(() => (result.value?.value ?? 0) >= 0)
</script>

<template>
  <div class="receipt-edge bg-paper px-7 pt-7 pb-11 font-receipt text-[0.95rem] leading-snug text-paper-ink sm:px-9">
    <table class="w-full">
      <caption class="pb-1 text-center">
        <span class="block font-bold tracking-wide uppercase">{{ issuer }}</span>
        {{ caption }}
      </caption>
      <thead class="sr-only">
        <tr>
          <th scope="col">Linha da DRE</th>
          <th scope="col">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(line, index) in items"
          :key="line.label"
          :class="[
            line.kind === 'total' && 'font-bold',
            (line.kind === 'total' || index === 0) && '[&>*]:border-t-2 [&>*]:border-dashed [&>*]:border-paper-rule [&>*]:pt-2.5',
          ]"
        >
          <th scope="row" class="pb-1 text-left [font-weight:inherit]">
            <span class="flex items-baseline gap-1.5">
              {{ line.label }}
              <span class="min-w-4 flex-1 border-b-2 border-dotted border-paper-rule/70" aria-hidden="true" />
            </span>
          </th>
          <td class="pb-1 pl-1.5 text-right whitespace-nowrap tabular-nums" :class="line.value < 0 && 'text-paper-loss'">
            {{ formatNumberWhole(line.value) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="result" class="mt-1.5 border-t-2 border-dashed border-paper-rule pt-4 text-center">
      <p>{{ result.label }}</p>
      <p class="mt-1 text-[1.9rem] font-bold tracking-tight tabular-nums" :class="!positive && 'text-paper-loss'">
        {{ formatCurrencyWhole(result.value) }}
      </p>
      <p v-if="margin !== null">{{ formatPercent(margin) }} da receita</p>
      <p
        class="mt-3 inline-block -rotate-6 animate-stamp border-[3px] px-3 py-0.5 font-bold tracking-widest uppercase [animation-delay:1800ms]"
        :class="positive ? 'border-paper-gain text-paper-gain' : 'border-paper-loss text-paper-loss'"
      >
        {{ positive ? 'No azul' : 'No vermelho' }}
      </p>
    </div>
  </div>
</template>
