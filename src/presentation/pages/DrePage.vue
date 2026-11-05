<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DreMetric } from '@/domain/dre'
import { relativeChange } from '@/domain/shared'
import ChartCard from '@/presentation/components/ChartCard.vue'
import DreTable from '@/presentation/components/DreTable.vue'
import InsightList from '@/presentation/components/InsightList.vue'
import NotFound from '@/presentation/components/NotFound.vue'
import PageHeader from '@/presentation/components/PageHeader.vue'
import PageSection from '@/presentation/components/PageSection.vue'
import PeriodSelect from '@/presentation/components/PeriodSelect.vue'
import ProfitTarget from '@/presentation/components/ProfitTarget.vue'
import RankingBarChart from '@/presentation/components/RankingBarChart.vue'
import ReportLayout from '@/presentation/components/ReportLayout.vue'
import type { NavSection } from '@/presentation/components/SectionNav.vue'
import SectionHeading from '@/presentation/components/SectionHeading.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import StatGrid from '@/presentation/components/StatGrid.vue'
import TrendChart from '@/presentation/components/TrendChart.vue'
import { useChartTheme } from '@/presentation/composables/useChartTheme'
import { DRE_MARGIN_LABELS, DRE_METRIC_INFO, DRE_METRIC_LABELS, useDreAnalysis } from '@/presentation/composables/useDreAnalysis'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatPeriod,
  formatPeriodList,
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

const kpiCards = computed(() =>
  (analysis.value?.kpis ?? []).map((kpi) => ({
    key: kpi.metric,
    label: DRE_METRIC_LABELS[kpi.metric],
    value: formatCurrencyCompact(kpi.value),
    hint: kpi.margin !== null ? `${DRE_MARGIN_LABELS[kpi.metric] ?? 'Margem'} ${formatPercent(kpi.margin)}` : undefined,
    delta: relativeChange(kpi.value, kpi.previous),
    info: DRE_METRIC_INFO[kpi.metric],
  })),
)

const INFO = {
  expenses:
    'Grupos de custos e despesas anteriores ao EBITDA no período selecionado, do maior para o menor. O tooltip mostra quanto cada um consome da receita bruta.',
  mix: 'Contas que formam a receita bruta, empilhadas mês a mês. Só aparecem as contas com movimento.',
  cash: 'Saldo final de caixa informado na DRE para cada mês (saldo inicial + variação).',
  target:
    'Receita necessária = (despesas operacionais + lucro desejado) ÷ margem de contribuição %. O lucro da meta é o resultado operacional: margem de contribuição − despesas operacionais. Outras receitas, depreciação e itens não operacionais ficam de fora. No acumulado do ano, receita e despesas são a média mensal.',
  insights: 'Frases geradas automaticamente a partir dos números. Passe o mouse no ícone de cada card para ver o cálculo.',
}

const navSections = computed<NavSection[]>(() => [
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'analise', label: 'Pontos de análise' },
  ...(analysis.value?.profitTarget ? [{ id: 'meta', label: 'Meta de lucro' }] : []),
  { id: 'custos', label: 'Custos e receita' },
  ...(analysis.value?.monthly.cash ? [{ id: 'caixa', label: 'Saldo de caixa' }] : []),
  { id: 'dre-completa', label: 'DRE completa' },
])

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
  <NotFound v-if="!report" message="DRE não encontrada." />

  <div v-else-if="analysis" class="space-y-6">
    <PageHeader title="Demonstração do resultado" :subtitle="report.name" />

    <p
      v-if="report.ignoredPeriods.length"
      class="rounded-lg border-l-4 border-l-primary bg-accent/40 px-4 py-3 text-sm text-body"
    >
      <strong class="font-semibold text-foreground">{{ formatPeriodList(report.ignoredPeriods) }}</strong>
      {{ report.ignoredPeriods.length === 1 ? 'não entra' : 'não entram' }} na análise: só contam os meses já encerrados.
      Mês em andamento e projeções da planilha ficam de fora até o mês terminar.
    </p>

    <ReportLayout :sections="navSections">
      <template #controls>
        <PeriodSelect v-model="selectedKey" :groups="periodGroups" />
      </template>

      <PageSection id="indicadores" class="space-y-3">
        <SectionHeading title="Indicadores" :subtitle="periodLabels.heading" />
        <StatGrid columns="grid-cols-2 md:grid-cols-3">
          <StatCard
            v-for="kpi in kpiCards"
            :key="kpi.key"
            :label="kpi.label"
            :value="kpi.value"
            :hint="kpi.hint"
            :delta="kpi.delta"
            :delta-label="periodLabels.previous"
            :info="kpi.info"
          />
        </StatGrid>
      </PageSection>

      <PageSection id="analise" class="space-y-3">
        <SectionHeading title="Pontos de análise" :info="INFO.insights" />
        <InsightList :insights="insights" />
      </PageSection>

      <PageSection v-if="analysis.profitTarget" id="meta" class="space-y-3">
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

      <PageSection id="custos" class="grid gap-3 xl:grid-cols-2">
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

        <ChartCard
          v-if="mixSeries.length > 1"
          title="Composição da receita"
          subtitle="Receita bruta por origem"
          :info="INFO.mix"
        >
          <TrendChart :categories="months" :series="mixSeries" :highlight-index="highlightIndex" />
        </ChartCard>
      </PageSection>

      <PageSection v-if="analysis.monthly.cash" id="caixa">
        <ChartCard
          :title="DRE_METRIC_LABELS[DreMetric.EndingCash]"
          subtitle="Saldo final de cada mês"
          :info="INFO.cash"
        >
          <TrendChart
            :categories="months"
            :series="[{ name: 'Saldo final', type: 'line', data: analysis.monthly.cash, color: theme.series[0] }]"
            :highlight-index="highlightIndex"
            :height="240"
          />
        </ChartCard>
      </PageSection>

      <PageSection id="dre-completa" class="space-y-3">
        <SectionHeading title="DRE completa" />
        <DreTable :report="report" :highlight="analysis.indexes" />
      </PageSection>
    </ReportLayout>
  </div>
</template>
