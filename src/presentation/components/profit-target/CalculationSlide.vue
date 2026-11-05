<script setup lang="ts">
import { computed } from 'vue'
import type { ProfitTargetBase, ReachableProjection } from '@/application'
import { formatCurrencyWhole, formatPercent, formatSignedCurrency, prettifyLabel } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  projection: ReachableProjection
  reference: string
  revenueName: string
  source: string
}>()

const contribution = computed(() => props.base.revenue * props.base.contributionRatio)
const perMonth = computed(() => (props.base.months > 1 ? `média mensal de ${props.base.months} meses` : props.reference))
const money = (value: number) => (value < 0 ? `(${formatCurrencyWhole(value)})` : formatCurrencyWhole(value))
</script>

<template>
  <div class="mt-1 space-y-6">
    <p class="text-sm text-muted-foreground">
      Três contas, com os números da DRE ({{ perMonth }}). Todos os valores são por mês.
    </p>
    <ol class="grid gap-3 lg:grid-cols-3">
      <li class="flex flex-col rounded-lg border bg-background/40 p-5">
        <span class="grid size-7 place-items-center rounded-full bg-muted text-sm font-semibold figure" aria-hidden="true">1</span>
        <h4 class="mt-3 font-semibold">Margem de contribuição</h4>
        <p class="text-sm text-muted-foreground">Quanto sobra de cada venda depois dos custos variáveis.</p>
        <p class="mt-auto pt-4 text-sm text-body figure">
          {{ money(contribution) }} ÷ {{ money(base.revenue) }}
        </p>
        <p class="text-2xl font-semibold figure">= {{ formatPercent(base.contributionRatio) }}</p>
        <p class="mt-1 text-xs text-muted-foreground">Margem de contribuição ÷ {{ revenueName.toLowerCase() }}</p>
      </li>
      <li class="flex flex-col rounded-lg border bg-background/40 p-5">
        <span class="grid size-7 place-items-center rounded-full bg-muted text-sm font-semibold figure" aria-hidden="true">2</span>
        <h4 class="mt-3 font-semibold">Despesas fixas</h4>
        <p class="text-sm text-muted-foreground">O que a empresa paga vendendo ou não.</p>
        <p class="mt-auto pt-4 text-sm text-body figure">
          <template v-if="base.months > 1">
            {{ formatCurrencyWhole(base.fixedCosts * base.months) }} ÷ {{ base.months }} meses
          </template>
          <template v-else>Linha da DRE {{ reference }}</template>
        </p>
        <p class="text-2xl font-semibold figure">= {{ formatCurrencyWhole(base.fixedCosts) }}</p>
        <p class="mt-1 text-xs text-muted-foreground">
          Despesas operacionais{{ base.months > 1 ? ', média mensal' : '' }}
        </p>
      </li>
      <li class="flex flex-col rounded-lg border border-primary bg-accent/40 p-5">
        <span
          class="grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground figure"
          aria-hidden="true"
          >3</span
        >
        <h4 class="mt-3 font-semibold">Receita necessária</h4>
        <p class="text-sm text-muted-foreground">Quanto vender para pagar as fixas e sobrar a meta.</p>
        <p class="mt-auto pt-4 text-sm text-body figure">
          ({{ formatCurrencyWhole(base.fixedCosts) }} + {{ formatCurrencyWhole(projection.target) }}) ÷
          {{ formatPercent(base.contributionRatio) }}
        </p>
        <p class="text-2xl font-semibold figure">= {{ formatCurrencyWhole(projection.revenue) }}</p>
        <p class="mt-1 text-xs text-muted-foreground">(Despesas fixas + lucro desejado) ÷ margem %</p>
      </li>
    </ol>
    <div class="rounded-lg border-l-4 border-l-success bg-success-soft px-5 py-4 text-sm">
      <p class="font-semibold text-foreground">A conta fecha</p>
      <p class="mt-1 text-body figure">
        {{ formatCurrencyWhole(projection.revenue) }} de receita − {{ formatCurrencyWhole(projection.variableCosts) }} de
        custos variáveis ({{ formatPercent(1 - base.contributionRatio) }} da receita) −
        {{ formatCurrencyWhole(projection.fixedCosts) }} de despesas fixas =
        <strong class="text-foreground">{{ formatCurrencyWhole(projection.target) }} de lucro</strong>
      </p>
    </div>
    <div class="grid gap-x-8 gap-y-4 text-sm lg:grid-cols-2">
      <div>
        <h4 class="font-semibold">De onde vêm os números</h4>
        <ul class="mt-2 space-y-1.5 text-body">
          <li>Base: {{ source }}<template v-if="base.months > 1">, média dos {{ base.months }} meses</template>.</li>
          <li v-if="base.revenueLabel">
            Receita considerada: só {{ revenueName }}. As outras receitas ({{ formatCurrencyWhole(base.excludedRevenue) }}
            por mês) ficam fora; custos variáveis e despesas continuam inteiros.
          </li>
          <li>Custos variáveis: linhas entre a receita e a margem de contribuição.</li>
          <li>
            Despesas fixas: linha "Despesas operacionais"<template v-if="base.months > 1">, média mensal</template>.
          </li>
          <li>
            Lucro: resultado operacional, hoje {{ formatCurrencyWhole(base.profit) }} por mês.
            <template v-if="base.excludedLines.length">
              Fora da conta:
              {{ base.excludedLines.map((line) => `${prettifyLabel(line.label)} (${formatSignedCurrency(line.value)})`).join(', ') }}.
            </template>
          </li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold">O que a conta supõe</h4>
        <ul class="mt-2 space-y-1.5 text-body">
          <li>Preços e custo de cada venda iguais aos de hoje: margem de {{ formatPercent(base.contributionRatio) }}.</li>
          <li>Despesas operacionais iguais. Se crescer exigir contratar ou alugar, a meta pede mais receita.</li>
        </ul>
      </div>
    </div>
  </div>
</template>
