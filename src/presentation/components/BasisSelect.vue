<script setup lang="ts">
import { PhBank, PhScales } from '@phosphor-icons/vue'
import { computed, useId } from 'vue'
import { DreRegime, type DreBasis } from '@/domain/dre'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'

/**
 * Os seletores da planilha: regime (caixa ou competência) e, no caixa, o banco.
 * Na competência a planilha soma todos os bancos, então o banco fica travado em "Todas".
 * `compact` esconde os rótulos (barra fixa ao rolar).
 */
const props = withDefaults(defineProps<{ basis: DreBasis; banks: readonly string[]; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ change: [basis: DreBasis] }>()

const ALL = '*'
const REGIMES = [
  { value: DreRegime.Cash, label: 'Caixa' },
  { value: DreRegime.Accrual, label: 'Competência' },
]

const regimeId = useId()
const bankId = useId()
const isAccrual = computed(() => props.basis.regime === DreRegime.Accrual)

const regime = computed({
  get: () => props.basis.regime,
  set: (value) => emit('change', { regime: value, bank: value === DreRegime.Accrual ? null : props.basis.bank }),
})
const bank = computed({
  get: () => (isAccrual.value ? ALL : (props.basis.bank ?? ALL)),
  set: (value) => emit('change', { regime: DreRegime.Cash, bank: value === ALL ? null : value }),
})

const TRIGGER =
  'border-band-border bg-transparent text-band-foreground transition-colors duration-(--duration-fast) hover:border-band-muted hover:bg-white/5 data-[size=default]:h-10 dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-band-muted disabled:opacity-60'
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

    <div v-if="banks.length" class="flex flex-col gap-1.5">
      <span :id="bankId" :class="compact ? 'sr-only' : 'text-band-muted'">Conta</span>
      <Select v-model="bank" :disabled="isAccrual">
        <SelectTrigger
          :aria-labelledby="bankId"
          :class="[TRIGGER, compact ? 'w-44 data-[size=default]:h-9 *:data-[slot=select-value]:truncate' : 'w-56']"
          :title="isAccrual ? 'Na competência, a DRE soma todas as contas, como na planilha.' : undefined"
        >
          <PhBank aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">Todas as contas</SelectItem>
          <SelectItem v-for="name in banks" :key="name" :value="name">{{ name }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
