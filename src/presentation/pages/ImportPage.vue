<script setup lang="ts">
import { PhChartLineUp, PhCheckCircle, PhX } from '@phosphor-icons/vue'
import { computed, onBeforeUnmount } from 'vue'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import ReportCard from '@/presentation/components/ReportCard.vue'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'
import { useFileImport } from '@/presentation/composables/useFileImport'
import { useReports } from '@/presentation/composables/useReports'
import { formatPeriod, formatPeriodList } from '@/presentation/format'
import { routeForReport } from '@/presentation/router'
import type { Report } from '@/domain/report'

const { reports, remove } = useReports()
const { isImporting, errors, lastImported, importFiles, dismissSummary, clearErrors } = useFileImport()
onBeforeUnmount(clearErrors)

const importSummary = computed(() => {
  const available = new Set(reports.value.map((report) => report.id))
  return lastImported.value.filter((report) => available.has(report.id))
})

const describePeriods = (report: Report) => {
  const count = report.periods.length
  const range = `${count} ${count === 1 ? 'mês' : 'meses'}, de ${formatPeriod(report.periods[0]!)} a ${formatPeriod(report.periods.at(-1)!)}`
  return report.ignoredPeriods.length ? `${range}; ${formatPeriodList(report.ignoredPeriods)} em aberto, fora da análise` : range
}
</script>

<template>
  <section class="space-y-10">
    <div class="max-w-3xl">
      <h1 class="text-4xl leading-tight font-bold tracking-tight">DRE da Boat Lux</h1>
      <p class="mt-2 text-lg text-body">
        Envie a planilha da DRE gerencial para ver os indicadores, os pontos de análise e a DRE completa do período.
      </p>
    </div>

    <FileDropzone :disabled="isImporting" @select="importFiles" />

    <TransitionGroup name="fade" tag="div" class="space-y-2">
      <p
        v-for="error in errors"
        :key="error"
        role="alert"
        class="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive"
      >
        {{ error }}
      </p>
    </TransitionGroup>

    <Transition name="fade">
      <Card v-if="importSummary.length" role="status" class="gap-3 border-l-4 border-l-success p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="flex items-center gap-2 text-lg font-semibold">
            <PhCheckCircle :size="22" weight="fill" class="text-success" aria-hidden="true" />
            Importação concluída
          </p>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar resumo da importação" @click="dismissSummary">
            <PhX aria-hidden="true" />
          </Button>
        </div>
        <ul class="divide-y divide-border">
          <li v-for="report in importSummary" :key="report.id" class="flex flex-wrap items-center justify-between gap-3 py-2">
            <span class="min-w-0 truncate text-sm">{{ report.name }}</span>
            <Button as-child size="sm">
              <RouterLink :to="routeForReport(report)">Visualizar</RouterLink>
            </Button>
          </li>
        </ul>
      </Card>
    </Transition>

    <div v-if="reports.length" class="space-y-4">
      <h2 class="text-2xl font-semibold tracking-tight">Demonstrações importadas</h2>
      <TransitionGroup name="list" tag="div" class="relative grid gap-3 lg:grid-cols-2">
        <ReportCard
          v-for="report in reports"
          :key="report.id"
          :title="report.name"
          :subtitle="describePeriods(report)"
          :to="routeForReport(report)"
          :icon="PhChartLineUp"
          removable
          @remove="remove(report.id)"
        />
      </TransitionGroup>
    </div>

    <p v-else class="text-muted-foreground">Nenhuma DRE importada ainda. A planilha que você enviar aparece aqui.</p>
  </section>
</template>
