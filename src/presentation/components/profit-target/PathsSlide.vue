<script setup lang="ts">
import { computed } from 'vue'
import type { ProfitTargetBase, ReachableProjection } from '@/application'
import { formatCurrencyCompact, formatCurrencyWhole, formatPercent, prettifyLabel } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  projection: ReachableProjection
  reference: string
}>()

const combined = computed(() => props.projection.paths?.combined ?? null)
</script>

<template>
  <div v-if="projection.paths" class="mt-1 space-y-5">
    <p class="text-sm text-body">
      Faltam <strong class="text-foreground figure">{{ formatCurrencyWhole(projection.paths.gap) }}</strong> de
      resultado por mês. Cada caminho abaixo fecha essa diferença sozinho<template v-if="combined">; o plano combinado divide o esforço</template>.
    </p>
    <ul class="grid gap-3 sm:grid-cols-2">
      <li class="flex flex-col rounded-lg border p-4">
        <h4 class="font-semibold">Vender mais</h4>
        <p class="mt-1 text-2xl font-semibold figure">+{{ formatCurrencyCompact(projection.paths.sales.amount) }}</p>
        <p class="text-sm text-body">
          de vendas por mês<template v-if="projection.paths.sales.change !== null">
            (+{{ formatPercent(projection.paths.sales.change) }})</template
          >, com os mesmos preços e custos.
        </p>
        <p class="mt-auto pt-2 text-xs text-muted-foreground">
          Diferença ÷ margem de contribuição de {{ formatPercent(base.contributionRatio) }}.
        </p>
      </li>
      <li v-if="projection.paths.price !== null" class="flex flex-col rounded-lg border p-4">
        <h4 class="font-semibold">Reajustar preços</h4>
        <p class="mt-1 text-2xl font-semibold figure">+{{ formatPercent(projection.paths.price) }}</p>
        <p class="text-sm text-body">nos preços, vendendo a mesma quantidade.</p>
        <p class="mt-auto pt-2 text-xs text-muted-foreground">
          Impostos, comissões e taxas acompanham o preço; o custo de compra não.
        </p>
      </li>
      <li v-if="projection.paths.purchases" class="flex flex-col rounded-lg border p-4">
        <h4 class="font-semibold">Negociar compras</h4>
        <p class="mt-1 text-2xl font-semibold figure">−{{ formatPercent(projection.paths.purchases.share) }}</p>
        <p class="text-sm text-body">
          no custo das mercadorias e serviços, ou
          {{ formatCurrencyCompact(projection.paths.purchases.amount) }} a menos por mês.
        </p>
        <p class="mt-auto pt-2 text-xs text-muted-foreground">Fornecedores, volume de compra ou troca de itens.</p>
      </li>
      <li v-if="projection.paths.fixed" class="flex flex-col rounded-lg border p-4">
        <h4 class="font-semibold">Cortar despesas operacionais</h4>
        <p class="mt-1 text-2xl font-semibold figure">−{{ formatCurrencyCompact(projection.paths.fixed.amount) }}</p>
        <p class="text-sm text-body">
          por mês, {{ formatPercent(projection.paths.fixed.share) }} das despesas operacionais.
        </p>
        <p v-if="base.fixedGroups.length" class="mt-auto pt-2 text-xs text-muted-foreground">
          Maiores grupos:
          {{
            base.fixedGroups
              .slice(0, 3)
              .map((group) => `${prettifyLabel(group.label)} (${formatCurrencyCompact(group.value)})`)
              .join(', ')
          }}.
        </p>
      </li>
      <li v-if="combined" class="rounded-lg border border-primary bg-accent/40 p-4 sm:col-span-2">
        <h4 class="font-semibold">Plano combinado</h4>
        <p class="text-sm text-muted-foreground">Cada frente cobre {{ combined.fronts === 3 ? 'um terço' : 'metade' }} da diferença.</p>
        <ul class="mt-3 grid gap-3 text-sm" :class="combined.fronts === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
          <li>
            <span class="block text-lg font-semibold figure">+{{ formatCurrencyCompact(combined.sales) }}</span>
            em vendas por mês
          </li>
          <li v-if="combined.price !== null">
            <span class="block text-lg font-semibold figure">+{{ formatPercent(combined.price) }}</span>
            nos preços
          </li>
          <li v-if="combined.fixed !== null">
            <span class="block text-lg font-semibold figure">−{{ formatCurrencyCompact(combined.fixed) }}</span>
            em despesas por mês
          </li>
        </ul>
      </li>
    </ul>
  </div>

  <div v-else class="mt-1 max-w-prose space-y-2">
    <p class="text-lg font-semibold text-success">A meta já é batida com os números de hoje</p>
    <p class="text-body">
      O resultado operacional {{ reference }} foi de {{ formatCurrencyWhole(base.profit) }}, acima da meta de
      {{ formatCurrencyWhole(projection.target) }}. A folga é de
      {{ formatCurrencyWhole(base.profit - projection.target) }} por mês: dá para absorver uma queda de vendas ou
      investir sem sair da meta.
    </p>
  </div>
</template>
