<script setup lang="ts">
import { PhArrowDownRight, PhArrowLeft, PhArrowUpRight, PhWarning } from '@phosphor-icons/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { DreMetric, DreRegime } from '@/domain/dre'
import { relativeChange } from '@/domain/shared'
import BasisSelect from '@/presentation/components/BasisSelect.vue'
import ChartCard from '@/presentation/components/ChartCard.vue'
import DebtsCard from '@/presentation/components/DebtsCard.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import OutsideEntries from '@/presentation/components/OutsideEntries.vue'
import SectionNav, { type NavSection } from '@/presentation/components/SectionNav.vue'
import StockCard from '@/presentation/components/StockCard.vue'
import InsightList from '@/presentation/components/InsightList.vue'
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

const { report, basis, setBasis, selections, selectedKey, analysis, periodLabels, insights, profitTargetFor } = useDreAnalysis()

/** Rótulo curto do regime, para a barra fixa e o subtítulo da página. */
const basisLabel = computed(() => {
  if (!report.value?.canChangeBasis) return ''
  const regime = basis.value.regime === DreRegime.Accrual ? 'Competência' : 'Caixa'
  return `${regime}, ${basis.value.unit ?? 'todas as unidades'}`
})

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

/** As seções do menu lateral, na ordem da página; só entram as que aparecem para esta planilha. */
const navSections = computed<NavSection[]>(() => {
  const a = analysis.value
  const r = report.value
  if (!a || !r) return []
  const sections: (NavSection | false)[] = [
    { id: 'indicadores', label: 'Indicadores' },
    { id: 'analise', label: 'Pontos de análise' },
    !!a.profitTarget && { id: 'meta', label: 'Meta de lucro' },
    { id: 'custos', label: 'Custos e receita' },
    !!a.monthly.cash && { id: 'caixa', label: 'Saldo de caixa' },
    { id: 'dre-completa', label: 'DRE completa' },
    !!(r.debts || r.stock) && { id: 'dividas-estoque', label: r.debts && r.stock ? 'Dívidas e estoque' : r.debts ? 'Dívidas' : 'Estoque' },
  ]
  return sections.filter((section): section is NavSection => !!section)
})

/** Barra fixa com os filtros: aparece quando o topo da página sai de vista. */
const heroHead = useTemplateRef('heroHead')
const docked = useScrolledPast(() => heroHead.value)

const INFO = {
  flow: 'A receita bruta do período dividida pelas etapas da DRE até o EBITDA: impostos sobre venda, custos das mercadorias e serviços vendidos, despesas variáveis e despesas fixas (já descontadas as outras receitas operacionais). O que sobra é o EBITDA. Valores por R$ 100 de receita, arredondados.',
  expenses:
    'Grupos de custos e despesas anteriores ao EBITDA no período selecionado, do maior para o menor. O tooltip mostra quanto cada um consome da receita bruta.',
  mix: 'Contas que formam a receita bruta, empilhadas mês a mês. Só aparecem as contas com movimento.',
  cash: 'Saldo final de caixa da DRE em cada mês (saldo inicial + variação). Os avisos abaixo do gráfico apontam meses em que o saldo inicial não continua o saldo final do mês anterior, sinal de lançamento faltando ou fora da DRE. Na competência o saldo não aparece, porque o saldo inicial só existe no caixa.',
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
  <div v-if="report && analysis">
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
        <div class="flex flex-wrap items-end gap-3">
          <BasisSelect v-if="report.canChangeBasis" :basis="basis" :units="report.units" @change="setBasis" />
          <PeriodSelect v-model="selectedKey" :groups="periodGroups" />
        </div>
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
          <p class="hidden min-w-0 items-center gap-3 lg:flex">
            <span class="truncate">{{ periodLabels.heading }}</span>
            <span v-if="headline" class="hidden items-center gap-2 text-band-muted xl:inline-flex">
              <span class="figure text-band-foreground">{{ headline.value }}</span>
              <ResultStamp :positive="headline.positive" size="sm" />
            </span>
          </p>
          <!-- Os mesmos filtros do topo: regime, conta e período continuam à mão ao rolar. -->
          <div class="-mx-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-none lg:overflow-visible lg:px-0">
            <PeriodSelect v-model="selectedKey" :groups="periodGroups" compact class="shrink-0" />
            <BasisSelect v-if="report.canChangeBasis" :basis="basis" :units="report.units" compact class="shrink-0" @change="setBasis" />
          </div>
        </div>
      </div>
    </Transition>

    <div class="page-fade mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 px-4 py-12 sm:px-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <SectionNav :sections="navSections" />

      <div class="min-w-0 space-y-14">
      <div v-if="report.ignoredPeriods.length || analysis.outside.length" class="space-y-3">
        <p v-if="report.ignoredPeriods.length" class="surface border-l-4 border-l-primary px-4 py-3 text-sm text-body">
          <span class="text-foreground">{{ formatPeriodList(report.ignoredPeriods) }}</span>
          {{ report.ignoredPeriods.length === 1 ? 'não entra' : 'não entram' }} na análise: só contam os meses já encerrados.
          Mês em andamento e projeções da planilha ficam de fora até o mês terminar.
        </p>
        <OutsideEntries :groups="analysis.outside" :when="periodLabels.when" />
      </div>

      <PageSection id="indicadores" class="space-y-5">
        <SectionHeading title="Indicadores" :subtitle="periodLabels.heading" />
        <StatGrid columns="grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3">
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

      <PageSection id="custos" class="grid items-start gap-5 xl:grid-cols-2">
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
          <ul v-if="analysis.cashBreaks.length" class="mt-4 space-y-1 border-t border-border pt-3 text-sm text-body">
            <li v-for="item in analysis.cashBreaks" :key="formatPeriod(item.period)" class="flex gap-2">
              <PhWarning :size="16" weight="fill" class="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                O saldo inicial de {{ formatPeriod(item.period) }} está
                <span class="figure">{{ formatCurrency(Math.abs(item.difference)) }}</span>
                {{ item.difference > 0 ? 'acima' : 'abaixo' }} do saldo final de {{ formatPeriod(item.previous) }}.
              </span>
            </li>
          </ul>
        </ChartCard>
      </PageSection>

      <PageSection id="dre-completa" class="space-y-5">
        <SectionHeading title="DRE completa" :subtitle="basisLabel || undefined" />
        <p v-if="report.staticLines.length" class="surface border-l-4 border-l-primary px-4 py-3 text-sm text-body">
          Valor digitado na planilha, que não muda com o regime nem com a unidade:
          <span class="text-foreground">{{ report.staticLines.map(prettifyLabel).join(', ') }}</span>.
        </p>
        <DreTable :report="report" :highlight="analysis.indexes" :basis="basisLabel || undefined">
          <template v-if="report.canChangeBasis" #filters>
            <BasisSelect :basis="basis" :units="report.units" compact tone="surface" @change="setBasis" />
          </template>
        </DreTable>
      </PageSection>

      <PageSection v-if="report.debts || report.stock" id="dividas-estoque" class="space-y-5">
        <SectionHeading title="Dívidas e estoque" subtitle="Posição atual, das abas de dívidas e de estoque da planilha" />
        <div class="grid items-start gap-5 xl:grid-cols-2">
          <DebtsCard v-if="report.debts" :schedule="report.debts" />
          <StockCard v-if="report.stock" :stock="report.stock" />
        </div>
      </PageSection>
      </div>
    </div>
  </div>
</template>
