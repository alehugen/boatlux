<script setup lang="ts">
import { PhHandCoins } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { debtOverview, type DebtSchedule } from '@/domain/debts'
import { formatCurrencyCompact, formatCurrencyWhole, formatIsoDate, formatPercent, formatPeriod, formatPeriodLong } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = defineProps<{ schedule: DebtSchedule; asOf?: Date }>()

const overview = computed(() => debtOverview(props.schedule, props.asOf))
const largest = computed(() => Math.max(...overview.value.debts.map((debt) => debt.balance), 1))


const info = computed(() =>
  [
    props.schedule.balanceFromSheet
      ? 'Saldo devedor de cada dívida como informado na coluna "Saldo" da aba de dívidas.'
      : 'Saldo devedor de cada dívida: soma das parcelas do mês atual em diante.',
    'O total soma todas as dívidas listadas.',
    `As parcelas são as previstas para ${formatPeriodLong(overview.value.reference)} no cronograma da planilha.`,
    'Não muda com o período nem com o regime escolhidos no topo da página.',
  ].join(' '),
)
</script>

<template>
  <article class="surface flex min-w-0 flex-col p-6" aria-labelledby="dividas-titulo">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h3 id="dividas-titulo" class="flex items-center gap-2 text-lg text-foreground">
          <PhHandCoins :size="22" class="text-primary" aria-hidden="true" />
          Dívidas
          <InfoTip :text="info" />
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ schedule.debts.length }} {{ schedule.debts.length === 1 ? 'dívida' : 'dívidas' }} em aberto<template
            v-if="schedule.updatedAt"
            >, planilha atualizada em {{ formatIsoDate(schedule.updatedAt) }}</template
          >
        </p>
      </div>
    </header>

    <dl class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <dt class="text-sm text-muted-foreground">Saldo devedor</dt>
        <dd class="text-[1.75rem] leading-tight figure text-foreground">{{ formatCurrencyCompact(overview.balance) }}</dd>
      </div>
      <div>
        <dt class="text-sm text-muted-foreground">Parcelas de {{ formatPeriod(overview.reference) }}</dt>
        <dd class="text-xl leading-tight figure text-foreground">{{ formatCurrencyCompact(overview.installment) }}</dd>
      </div>
      <div>
        <dt class="text-sm text-muted-foreground">Última parcela</dt>
        <dd class="text-xl leading-tight figure text-foreground">
          {{ overview.payoff ? formatPeriod(overview.payoff) : '–' }}
        </dd>
      </div>
    </dl>

    <ul class="mt-6 space-y-4 border-t border-border pt-5">
      <li v-for="(debt, i) in overview.debts" :key="`${i}-${debt.label}`">
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 truncate text-foreground" :title="debt.label">{{ debt.label }}</span>
          <span class="figure whitespace-nowrap text-foreground">{{ formatCurrencyWhole(debt.balance) }}</span>
        </div>
        <div
          class="mt-1.5 h-1.5 rounded-full bg-muted"
          role="img"
          :aria-label="`${formatPercent(debt.balance / (overview.balance || 1))} do saldo devedor`"
        >
          <div class="h-full rounded-full bg-primary" :style="{ width: `${(debt.balance / largest) * 100}%` }" />
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          <template v-if="debt.installment">Parcela de <span class="figure">{{ formatCurrencyWhole(debt.installment) }}</span></template>
          <template v-else>Sem parcela em {{ formatPeriod(overview.reference) }}</template>
          <template v-if="debt.payoff">, última em {{ formatPeriod(debt.payoff) }}</template>
        </p>
      </li>
    </ul>
  </article>
</template>
