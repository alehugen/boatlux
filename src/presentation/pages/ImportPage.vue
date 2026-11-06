<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { DreMetric } from '@/domain/dre'
import type { Report } from '@/domain/report'
import { container } from '@/infrastructure/container'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import PageBand from '@/presentation/components/PageBand.vue'
import { Button } from '@/presentation/components/ui/button'
import { useFileImport } from '@/presentation/composables/useFileImport'
import { useReports } from '@/presentation/composables/useReports'
import { formatPeriod } from '@/presentation/format'
import { routeForReport } from '@/presentation/router'

const router = useRouter()
const { reports, remove } = useReports()
const { isImporting, errors, importFiles, clearErrors } = useFileImport()
onBeforeUnmount(clearErrors)

/** Uma planilha importada sem erros abre direto na DRE. */
async function onSelect(files: File[]) {
  const imported = await importFiles(files)
  if (imported.length === 1 && !errors.value.length) await router?.push(routeForReport(imported[0]!))
}

const describePeriods = (report: Report) => {
  const count = report.periods.length
  return `${formatPeriod(report.periods[0]!)} a ${formatPeriod(report.periods.at(-1)!)}, ${count} ${count === 1 ? 'mês' : 'meses'}`
}

/** Como fechou o último mês encerrado, pelo EBITDA. */
function lastMonthOf(report: Report) {
  const [latest] = container.analyzeDre.selections(report)
  if (!latest || latest.type !== 'month') return null
  const ebitda = container.analyzeDre.execute(report, latest).kpis.find((kpi) => kpi.metric === DreMetric.Ebitda)
  return ebitda ? { positive: ebitda.value >= 0, period: formatPeriod(report.periods[latest.index]!) } : null
}

const rows = computed(() =>
  reports.value.map((report) => ({ report, periods: describePeriods(report), lastMonth: lastMonthOf(report) })),
)
</script>

<template>
  <div>
    <PageBand>
      <div class="max-w-3xl pt-8">
        <h1 class="text-[2.45rem] leading-tight">Importe a DRE do mês</h1>
        <p class="mt-3 max-w-[60ch] text-lg leading-relaxed text-band-muted">
          Arraste a planilha da DRE gerencial. Ela abre direto no resultado do último mês encerrado.
        </p>
      </div>

      <FileDropzone :disabled="isImporting" class="mt-8" @select="onSelect" />

      <TransitionGroup name="fade" tag="div" class="mt-4 space-y-2 empty:hidden">
        <p
          v-for="error in errors"
          :key="error"
          role="alert"
          class="rounded-sm border-l-4 border-l-band-loss bg-white/5 px-4 py-3 text-sm text-band-foreground"
        >
          {{ error }}
        </p>
      </TransitionGroup>
    </PageBand>

    <section class="page-fade mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <h2 class="text-[1.5625rem] leading-tight">DREs importadas</h2>

      <TransitionGroup v-if="rows.length" name="list" tag="ul" class="relative mt-5 space-y-3">
        <li
          v-for="{ report, periods, lastMonth } in rows"
          :key="report.id"
          class="surface grid gap-x-6 gap-y-2 px-5 py-4 transition-shadow duration-(--duration-base) hover:shadow-raised sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_16rem_14rem_auto] lg:items-center"
        >
          <span class="truncate text-lg">{{ report.name }}</span>
          <span class="text-[0.95rem] text-muted-foreground">{{ periods }}</span>
          <span v-if="lastMonth" class="text-[0.95rem]">
            <span
              class="mr-1.5 inline-block size-2 rounded-full align-middle"
              :class="lastMonth.positive ? 'bg-success' : 'bg-destructive'"
              aria-hidden="true"
            />
            <span :class="lastMonth.positive ? 'text-success' : 'text-destructive'">
              {{ lastMonth.positive ? 'No azul' : 'No vermelho' }}
            </span>
            <span class="text-muted-foreground"> em {{ lastMonth.period }}</span>
          </span>
          <span v-else />
          <span class="flex gap-2 sm:row-span-3 sm:row-start-1 sm:col-start-2 lg:row-span-1 lg:col-start-4">
            <Button variant="outline" class="text-muted-foreground" :aria-label="`Remover ${report.name}`" @click="remove(report.id)">
              Remover
            </Button>
            <Button as-child>
              <RouterLink :to="routeForReport(report)" :aria-label="`Abrir DRE ${report.name}`">Abrir DRE</RouterLink>
            </Button>
          </span>
        </li>
      </TransitionGroup>

      <p v-else class="mt-3 text-muted-foreground">Nenhuma DRE importada ainda. Arraste a planilha na área acima para começar.</p>
    </section>
  </div>
</template>
