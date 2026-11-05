<script setup lang="ts">
import { PhCalendarBlank, PhCaretDown } from '@phosphor-icons/vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import type { Period } from '@/domain/shared'
import { Button } from '@/presentation/components/ui/button'
import { formatPeriod } from '@/presentation/format'

const props = defineProps<{ periods: readonly Period[] }>()
const shown = defineModel<number[]>({ required: true })

const all = computed(() => props.periods.map((_, index) => index))
const isShown = (index: number) => shown.value.includes(index)
const summary = computed(() => (shown.value.length === props.periods.length ? 'todos' : `${shown.value.length} de ${props.periods.length}`))

const years = computed(() =>
  [...new Set(props.periods.map((p) => p.year))].map((year) => ({
    year,
    months: all.value.filter((index) => props.periods[index]!.year === year),
  })),
)

const presets = computed(() => {
  const count = props.periods.length
  const last = (n: number) => all.value.slice(-n)
  return [
    { label: 'Todos', indexes: all.value },
    ...[3, 6].filter((n) => n < count).map((n) => ({ label: `Últimos ${n}`, indexes: last(n) })),
    ...(years.value.length > 1 ? years.value.map(({ year, months }) => ({ label: String(year), indexes: months })) : []),
  ]
})

const sameAs = (indexes: number[]) => indexes.length === shown.value.length && indexes.every(isShown)

function toggle(index: number) {
  if (isShown(index)) {
    if (shown.value.length > 1) shown.value = shown.value.filter((i) => i !== index)
  } else shown.value = [...shown.value, index].sort((a, b) => a - b)
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <Button variant="outline" class="gap-2">
        <PhCalendarBlank weight="bold" aria-hidden="true" />
        Meses: {{ summary }}
        <PhCaretDown :size="12" weight="bold" class="text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="6"
        :collision-padding="12"
        class="z-50 w-80 max-w-(--reka-popover-content-available-width) space-y-4 rounded-xl border bg-popover p-4 text-popover-foreground shadow-floating"
      >
        <div class="space-y-2">
          <p class="text-sm font-medium">Mostrar na tabela</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in presets"
              :key="preset.label"
              type="button"
              class="rounded-full border px-3 py-1 text-sm transition-colors duration-(--duration-fast) ease-out"
              :class="sameAs(preset.indexes) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'"
              :aria-pressed="sameAs(preset.indexes)"
              @click="shown = [...preset.indexes]"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
        <div v-for="group in years" :key="group.year" class="space-y-2">
          <p v-if="years.length > 1" class="text-sm text-muted-foreground figure">{{ group.year }}</p>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="index in group.months"
              :key="index"
              type="button"
              class="rounded-md border py-1.5 text-sm figure transition-colors duration-(--duration-fast) ease-out"
              :class="isShown(index) ? 'border-primary bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="isShown(index)"
              :disabled="isShown(index) && shown.length === 1"
              @click="toggle(index)"
            >
              {{ formatPeriod(periods[index]!) }}
            </button>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">Os cálculos da página não mudam: isto só esconde colunas da tabela.</p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
