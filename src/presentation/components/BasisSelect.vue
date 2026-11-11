<script setup lang="ts">
import { PhBank, PhScales, PhStorefront } from '@phosphor-icons/vue'
import { computed, useId } from 'vue'
import { BOATLUX_LAYOUT, DreRegime, type DreBasis, type DreSegment } from '@/domain/dre'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'

/**
 * Os seletores da DRE: regime (caixa ou competência) e o filtro do modelo, a unidade na Boatlux (Repasse,
 * Comercial, GC...) ou o banco na RS Náutica. "Todas as unidades" / "Todos os bancos" soma a empresa inteira. `compact` esconde os rótulos (barra fixa ao rolar);
 * `tone="surface"` usa as cores do card, para a DRE em tela cheia.
 */
const props = withDefaults(
  defineProps<{
    basis: DreBasis
    units: readonly string[]
    segment?: DreSegment
    compact?: boolean
    tone?: 'band' | 'surface'
  }>(),
  { segment: () => BOATLUX_LAYOUT.segment, compact: false, tone: 'band' },
)
const emit = defineEmits<{ change: [basis: DreBasis] }>()

const ALL = '*'
const REGIMES = [
  { value: DreRegime.Cash, label: 'Caixa' },
  { value: DreRegime.Accrual, label: 'Competência' },
]

/** Na RS, os lançamentos de competência não têm banco: o filtro fica desligado, como na fórmula da planilha. */
const segmentOff = computed(() => props.basis.regime === DreRegime.Accrual && !props.segment.inAccrual)
const SEGMENT_OFF_HINT = 'Na competência, a planilha soma todos os bancos'

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

const BAND_TRIGGER =
  'border-band-border bg-transparent text-band-foreground hover:border-band-muted hover:bg-white/5 dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-band-muted'
const SURFACE_TRIGGER = 'bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted [&_svg]:text-muted-foreground'
const trigger = computed(() => [
  '*:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate transition-colors duration-(--duration-fast) data-[size=default]:h-10',
  props.tone === 'surface' ? SURFACE_TRIGGER : BAND_TRIGGER,
])
</script>

<template>
  <div class="flex items-end text-sm" :class="compact ? 'gap-2' : 'flex-wrap gap-3'">
    <div class="flex flex-col gap-1.5">
      <span :id="regimeId" :class="compact ? 'sr-only' : tone === 'surface' ? 'text-muted-foreground' : 'text-band-muted'">Regime</span>
      <Select v-model="regime">
        <SelectTrigger :aria-labelledby="regimeId" :class="[trigger, compact ? 'w-36 data-[size=default]:h-9' : 'w-40']">
          <PhScales aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in REGIMES" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="units.length" class="flex flex-col gap-1.5">
      <span :id="unitId" :class="compact ? 'sr-only' : tone === 'surface' ? 'text-muted-foreground' : 'text-band-muted'">{{ segment.label }}</span>
      <Select v-model="unit" :disabled="segmentOff">
        <SelectTrigger
          :aria-labelledby="unitId"
          :title="segmentOff ? SEGMENT_OFF_HINT : undefined"
          :class="[trigger, compact ? [segment.kind === 'bank' ? 'w-52' : 'w-44', 'data-[size=default]:h-9'] : 'w-52']"
        >
          <PhBank v-if="segment.kind === 'bank'" aria-hidden="true" />
          <PhStorefront v-else aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="name in units" :key="name" :value="name">{{ name }}</SelectItem>
          <SelectItem :value="ALL">{{ segment.all }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
