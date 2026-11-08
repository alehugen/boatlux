<script setup lang="ts">
import { PhScales, PhStorefront } from '@phosphor-icons/vue'
import { computed, useId } from 'vue'
import { DreRegime, type DreBasis } from '@/domain/dre'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'

/**
 * Os seletores da aba DRE Unidades: regime (caixa ou competência) e unidade (Repasse, Comercial, GC...).
 * "Todas as unidades" soma a empresa inteira. `compact` esconde os rótulos (barra fixa ao rolar).
 */
const props = withDefaults(defineProps<{ basis: DreBasis; units: readonly string[]; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ change: [basis: DreBasis] }>()

const ALL = '*'
const REGIMES = [
  { value: DreRegime.Cash, label: 'Caixa' },
  { value: DreRegime.Accrual, label: 'Competência' },
]

const regimeId = useId()
const unitId = useId()

const regime = computed({
  get: () => props.basis.regime,
  set: (value) => emit('change', { regime: value, unit: props.basis.unit }),
})
const unit = computed({
  get: () => props.basis.unit ?? ALL,
  set: (value) => emit('change', { regime: props.basis.regime, unit: value === ALL ? null : value }),
})

const TRIGGER =
  '*:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate border-band-border bg-transparent text-band-foreground transition-colors duration-(--duration-fast) hover:border-band-muted hover:bg-white/5 data-[size=default]:h-10 dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-band-muted'
</script>

<template>
  <div class="flex items-end text-sm" :class="compact ? 'gap-2' : 'flex-wrap gap-3'">
    <div class="flex flex-col gap-1.5">
      <span :id="regimeId" :class="compact ? 'sr-only' : 'text-band-muted'">Regime</span>
      <Select v-model="regime">
        <SelectTrigger :aria-labelledby="regimeId" :class="[TRIGGER, compact ? 'w-36 data-[size=default]:h-9' : 'w-40']">
          <PhScales aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in REGIMES" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="units.length" class="flex flex-col gap-1.5">
      <span :id="unitId" :class="compact ? 'sr-only' : 'text-band-muted'">Unidade</span>
      <Select v-model="unit">
        <SelectTrigger :aria-labelledby="unitId" :class="[TRIGGER, compact ? 'w-44 data-[size=default]:h-9' : 'w-52']">
          <PhStorefront aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="name in units" :key="name" :value="name">{{ name }}</SelectItem>
          <SelectItem :value="ALL">Todas as unidades</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
