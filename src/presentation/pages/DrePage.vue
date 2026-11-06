<script setup lang="ts">
import { PhArrowDownRight, PhArrowLeft, PhArrowUpRight } from '@phosphor-icons/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { DreMetric } from '@/domain/dre'
import { relativeChange } from '@/domain/shared'
import ChartCard from '@/presentation/components/ChartCard.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import InsightList from '@/presentation/components/InsightList.vue'
import NotFound from '@/presentation/components/NotFound.vue'
import PageBand from '@/presentation/components/PageBand.vue'
import PageSection from '@/presentation/components/PageSection.vue'
import PeriodSelect from '@/presentation/components/PeriodSelect.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import RankingBarChart from '@/presentation/components/RankingBarChart.vue'
import ResultStamp from '@/presentation/components/ResultStamp.vue'
import RevenueBar from '@/presentation/components/RevenueBar.vue'
import SectionHeading from '@/presentation/components/SectionHeading.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import StatGrid from '@/presentation/components/StatGrid.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import { useChartTheme } from '@/presentation/composables/useChartTheme'
import { DRE_MARGIN_LABELS, DRE_METRIC_INFO, DRE_METRIC_LABELS, useDreAnalysis } from '@/presentation/composables/useDreAnalysis'
import { useScrolledPast } from '@/presentation/composables/useScroll'
import { useTweenedNumbers } from '@/presentation/composables/useTween'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatPeriod,
  formatPeriodList,
  formatSignedPercent,
  prettifyLabel,
} from '@/presentation/format'

const props = defineProps<{ id: string }>()
const { report, selections, selectedKey, analysis, periodLabels, insights, profitTargetFor } = useDreAnalysis(() => props.id)

const ALL_REVENUE = 'all'
const revenueSource = ref(ALL_REVENUE)
const revenueOptions = computed(() => [
  { value: ALL_REVENUE, label: 'Receita bruta' },
  ...(analysis.value?.revenueSources ?? []).map((source) => ({ value: source.id, label: prettifyLabel(source.label) })),
])
watch(revenueOptions, (options) => {
  if (!options.some((option) => option.value === revenueSource.value)) revenueSource.value = ALL_REVENUE
})
const targetBase = computed(() =>
  revenueSource.value === ALL_REVENUE ? (analysis.value?.profitTarget ?? null) : profitTargetFor([revenueSource.value]),
)
const theme = useChartTheme()

const periodGroups = computed(() => [
  { label: 'Mês', options: selections.value.filter((o) => o.type === 'month') },
  { label: 'Acumulado no ano', options: selections.value.filter((o) => o.type === 'year') },
])

const months = computed(() => report.value?.periods.map(formatPeriod) ?? [])
const highlightIndex = computed(() => (analysis.value?.indexes.length === 1 ? analysis.value.indexes[0] : undefined))

/** Os números principais contam até o novo valor ao trocar de período. */
const kpis = computed(() => analysis.value?.kpis ?? [])
const tweened = useTweenedNumbers(() => kpis.value.map((kpi) => kpi.value))

/** O resultado da faixa do topo é o EBITDA: o que sobra da operação, a mesma conta da barra. */
const headline = computed(() => {
  const index = kpis.value.findIndex((kpi) => kpi.metric === DreMetric.Ebitda)
  const ebitda = kpis.value[index]
  if (!ebitda) return null
  return {
    value: formatCurrencyCompact(tweened.value[index] ?? ebitda.value),
    positive: ebitda.value >= 0,
    margin: ebitda.margin,
    delta: relativeChange(ebitda.value, ebitda.previous),
  }
})

const kpiCards = computed(() =>
  kpis.value.map((kpi, index) => ({
    key: kpi.metric,
    label: DRE_METRIC_LABELS[kpi.metric],
    value: formatCurrencyCompact(tweened.value[index] ?? kpi.value),
    negative: kpi.value < 0,
    hint: kpi.margin !== null ? `${DRE_MARGIN_LABELS[kpi.metric] ?? 'Margem'} ${formatPercent(kpi.margin)}` : undefined,
    delta: relativeChange(kpi.value, kpi.previous),
    info: DRE_METRIC_INFO[kpi.metric],
  })),
)

/** Barra fixa com o período: aparece quando o topo da página sai de vista. */
const heroHead = useTemplateRef('heroHead')
const docked = useScrolledPast(() => heroHead.value)

const INFO = {
  flow: 'A receita bruta do período dividida pelas etapas da DRE até o EBITDA: impostos sobre venda, custos das mercadorias e serviços vendidos, despesas variáveis e despesas fixas (já descontadas as outras receitas operacionais). O que sobra é o EBITDA. Valores por R$ 100 de receita, arredondados.',
  expenses:
    'Grupos de custos e despesas anteriores ao EBITDA no período selecionado, do maior para o menor. O tooltip mostra quanto cada um consome da receita bruta.',
  mix: 'Contas que formam a receita bruta, empilhadas mês a mês. Só aparecem as contas com movimento.',
  cash: 'Saldo final de caixa informado na DRE para cada mês (saldo inicial + variação).',
  target:
    'Receita necessária = (despesas operacionais + lucro desejado) ÷ margem de contribuição %. O lucro da meta é o resultado operacional: margem de contribuição − despesas operacionais. Outras receitas, depreciação e itens não operacionais ficam de fora. No acumulado do ano, receita e despesas são a média mensal.',
  insights: 'Frases geradas automaticamente a partir dos números. Passe o mouse no ícone de cada ponto para ver o cálculo.',
}

const mixSeries = computed(() =>
  (analysis.value?.monthly.revenueMix ?? []).map((s) => ({
    name: prettifyLabel(s.label),
    type: 'bar' as const,
    stack: 'mix',
    data: s.values,
  })),
)

const expenseItems = computed(() =>
  (analysis.value?.expenses ?? []).slice(0, 10).map((e) => ({
    label: prettifyLabel(e.label),
    value: e.value,
    detail: `${formatPercent(e.share)} da receita`,
  })),
)
</script>

<template>
  <div v-if="!report" class="page-fade mx-auto max-w-7xl px-4 py-10 sm:px-8">
    <NotFound message="DRE não encontrada." />
  </div>

  <div v-else-if="analysis">
    <PageBand>
      <RouterLink
        :to="{ name: 'import' }"
        class="inline-flex items-center gap-1.5 rounded-sm text-sm text-band-muted transition-colors duration-(--duration-fast) hover:text-band-foreground"
      >
        <PhArrowLeft aria-hidden="true" />
        Voltar ao início
      </RouterLink>

      <div ref="heroHead" class="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-[1.95rem] leading-tight">{{ periodLabels.heading }}</h1>
          <p class="mt-1 truncate text-sm text-band-muted">{{ report.name }}</p>
        </div>
        <PeriodSelect v-model="selectedKey" :groups="periodGroups" />
      </div>

      <div v-if="headline" class="mt-9">
        <p class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span class="text-5xl leading-none figure sm:text-[4rem]">{{ headline.value }}</span>
          <ResultStamp :positive="headline.positive" />
        </p>
        <p class="mt-3 text-lg text-band-muted">
          <template v-if="headline.margin !== null">EBITDA de {{ formatPercent(headline.margin) }} da receita</template>
          <template v-if="headline.delta !== null && Number.isFinite(headline.delta) && periodLabels.previous">
            <span aria-hidden="true"> · </span>
            <span :class="headline.delta >= 0 ? 'text-band-gain' : 'text-band-loss'">
              <PhArrowUpRight v-if="headline.delta >= 0" class="inline" aria-hidden="true" />
              <PhArrowDownRight v-else class="inline" aria-hidden="true" />
              {{ formatSignedPercent(headline.delta) }}
            </span>
            em relação a {{ periodLabels.previous }}
          </template>
        </p>
      </div>

      <RevenueBar v-if="analysis.revenueFlow" :flow="analysis.revenueFlow" :info="INFO.flow" class="mt-11" />
    </PageBand>

    <Transition name="dock">
      <div
        v-if="docked"
        class="fixed inset-x-0 top-18 z-(--layer-nav) border-t border-band-border/60 bg-band text-band-foreground shadow-floating"
      >
        <div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <p class="flex min-w-0 items-center gap-3">
            <span class="truncate">{{ periodLabels.heading }}</span>
            <span v-if="headline" class="hidden items-center gap-2 text-band-muted sm:inline-flex">
              <span class="figure text-band-foreground">{{ headline.value }}</span>
              <ResultStamp :positive="headline.positive" size="sm" />
            </span>
          </p>
          <PeriodSelect v-model="selectedKey" :groups="periodGroups" compact />
        </div>
      </div>
    </Transition>

    <div class="page-fade mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-8">
      <p v-if="report.ignoredPeriods.length" class="surface border-l-4 border-l-primary px-4 py-3 text-sm text-body">
        <span class="text-foreground">{{ formatPeriodList(report.ignoredPeriods) }}</span>
        {{ report.ignoredPeriods.length === 1 ? 'não entra' : 'não entram' }} na análise: só contam os meses já encerrados.
        Mês em andamento e projeções da planilha ficam de fora até o mês terminar.
      </p>

      <PageSection id="indicadores" class="space-y-5">
        <SectionHeading title="Indicadores" :subtitle="periodLabels.heading" />
        <StatGrid columns="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            v-for="kpi in kpiCards"
            :key="kpi.key"
            :label="kpi.label"
            :value="kpi.value"
            :negative="kpi.negative"
            :hint="kpi.hint"
            :delta="kpi.delta"
            :delta-label="periodLabels.previous"
            :info="kpi.info"
          />
        </StatGrid>
      </PageSection>

      <PageSection id="analise" class="space-y-5">
        <SectionHeading title="Pontos de análise" :info="INFO.insights" />
        <InsightList :insights="insights" />
      </PageSection>

      <PageSection v-if="analysis.profitTarget" id="meta" class="space-y-5">
        <SectionHeading
          title="Meta de lucro"
          subtitle="Quanto a empresa precisa vender por mês para lucrar o valor escolhido"
          :info="INFO.target"
        />
        <ProfitTarget
          v-if="targetBase"
          v-model:revenue="revenueSource"
          :revenue-options="revenueOptions"
          :base="targetBase"
          :reference="periodLabels.reference"
          :source="`${report.name}, ${periodLabels.currentLong}`"
        />
      </PageSection>

      <PageSection id="custos" class="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Para onde vai a receita"
          :subtitle="`Custos e despesas operacionais: ${periodLabels.currentLong}`"
          :info="INFO.expenses"
        >
          <RankingBarChart
            :items="expenseItems"
            value-label="Valor"
            :format-value="formatCurrency"
            :format-axis="formatCurrencyCompact"
          />
        </ChartCard>

        <ChartCard v-if="mixSeries.length > 1" title="Composição da receita" subtitle="Receita bruta por origem" :info="INFO.mix">
          <TrendChart :categories="months" :series="mixSeries" :highlight-index="highlightIndex" />
        </ChartCard>
      </PageSection>

      <PageSection v-if="analysis.monthly.cash" id="caixa">
        <ChartCard :title="DRE_METRIC_LABELS[DreMetric.EndingCash]" subtitle="Saldo final de cada mês" :info="INFO.cash">
          <TrendChart
            :categories="months"
            :series="[{ name: 'Saldo final', type: 'line', data: analysis.monthly.cash, color: theme.series[0] }]"
            :highlight-index="highlightIndex"
            :height="240"
          />
        </ChartCard>
      </PageSection>

      <PageSection id="dre-completa" class="space-y-5">
        <SectionHeading title="DRE completa" />
        <DreTable :report="report" :highlight="analysis.indexes" />
      </PageSection>
    </div>
  </div>
</template>
