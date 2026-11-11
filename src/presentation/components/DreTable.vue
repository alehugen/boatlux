<script setup lang="ts">
import { PhCaretRight } from '@phosphor-icons/vue'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { DreLineKind, DreMetric, type DreLine, type DreReport } from '@/domain/dre'
import { periodKey } from '@/domain/shared'
import { useCellBreakdown } from '@/presentation/composables/useCellBreakdown'
import { formatPercent, formatPeriod, formatPeriodLong, prettifyLabel } from '@/presentation/format'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import AppModal from './AppModal.vue'
import CellBreakdown from './CellBreakdown.vue'
import ExpandablePanel from './ExpandablePanel.vue'
import ExpandButton from './ExpandButton.vue'
import InfoTip from './InfoTip.vue'
import MonthFilter from './MonthFilter.vue'
import SegmentedControl from './SegmentedControl.vue'

/** `basis`: regime e unidade, no subtítulo. O slot `filters` aparece só em tela cheia, para trocar de unidade sem sair dela. */
/** `highlight`: meses do período selecionado, só para rolar a tabela até eles (sem destaque visual). */
const props = defineProps<{ report: DreReport; highlight: number[]; basis?: string }>()
defineSlots<{ filters?: () => unknown }>()
const subtitle = computed(() => [props.report.name, props.basis].filter(Boolean).join(' · '))
const { open, breakdown, canInspect, inspect } = useCellBreakdown(() => props.report)

const TABLE_INFO =
  'Valores como na planilha: receitas positivas, custos e despesas negativos. Os totais de cada grupo e os resultados aparecem em destaque. AV % = cada linha ÷ receita bruta do mesmo mês. Clique em um grupo para ver as contas que o compõem. Em Meses, escolha quais meses aparecem, para focar em um período ao apresentar. Quando a planilha traz a aba de fluxo de caixa, clique em um valor para ver os lançamentos que o compõem.'

const MODES = [
  { value: 'value', label: 'Valores (R$)' },
  { value: 'av', label: 'AV % da receita' },
] as const
const mode = ref<Mode>('value')
const showZero = ref(false)
const allMonths = () => props.report.periods.map((_, index) => index)
const shown = ref(allMonths())
/** Com poucos meses (ex.: os últimos 3 para apresentar), a tabela fica centralizada em vez de colada à direita. */
const compact = computed(() => shown.value.length <= 6)
/** Trocar regime ou unidade recalcula o relatório com os mesmos meses: a escolha de meses só volta a "todos" com outra planilha. */
watch(
  () => props.report.periods.map(periodKey).join(),
  () => (shown.value = allMonths()),
)
const expanded = ref(new Set(props.report.lines.filter((l) => l.kind === DreLineKind.Section).map((l) => l.id)))

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const revenue = computed(() => props.report.metric(DreMetric.GrossRevenue))
const isZero = (line: DreLine) => shown.value.every((i) => (line.values[i] ?? 0) === 0)
const hasChildren = (line: DreLine) => props.report.lines.some((l) => l.parentId === line.id && (showZero.value || !isZero(l)))

const byId = computed(() => new Map(props.report.lines.map((l) => [l.id, l])))
const isVisible = (line: DreLine): boolean => {
  if (!showZero.value && isZero(line)) return false
  if (!line.parentId) return true
  const parent = byId.value.get(line.parentId)
  return !!parent && expanded.value.has(parent.id) && isVisible(parent)
}
const rows = computed(() => props.report.lines.filter(isVisible))

const depth = (line: DreLine) => (line.parentId ? (byId.value.get(line.parentId)?.parentId ? 2 : 1) : 0)

function toggle(line: DreLine) {
  const next = new Set(expanded.value)
  if (next.has(line.id)) next.delete(line.id)
  else next.add(line.id)
  expanded.value = next
}

type Mode = (typeof MODES)[number]['value']

function format(line: DreLine, index: number, as: Mode) {
  const value = line.values[index] ?? 0
  if (as === 'value') return value === 0 ? '–' : integer.format(value)
  const base = revenue.value?.values[index] ?? 0
  return base && value ? formatPercent(value / base) : '–'
}

/**
 * Faixas como na planilha: resultado no tom mais escuro, seção em azul forte e grupo em azul claro,
 * com o rótulo em maiúsculas. Contas ficam no fundo do card, sem cor nos negativos.
 */
const BANDS: Partial<Record<DreLine['kind'], { bg: string; text: string }>> = {
  [DreLineKind.Result]: { bg: 'bg-result', text: 'text-result-foreground' },
  [DreLineKind.Section]: { bg: 'bg-section', text: 'text-section-foreground' },
  [DreLineKind.Group]: { bg: 'bg-group', text: 'text-group-foreground' },
}
const band = (line: DreLine) => BANDS[line.kind]
const rowClass = (line: DreLine) => {
  const tone = band(line)
  if (tone) return [tone.bg, tone.text, 'uppercase tracking-[0.02em]']
  return ['hover:bg-muted/60', line.parentId ? 'text-body' : 'text-foreground']
}

const cell = (line: DreLine, index: number) => format(line, index, mode.value)
const CELL_TEXT = 'inline-grid justify-items-end after:invisible after:content-[attr(data-alt)] after:[grid-area:1/1]'
const otherMode = computed<Mode>(() => (mode.value === 'value' ? 'av' : 'value'))

const scroller = useTemplateRef('scroller')
/** Com a tabela rolada para o lado, a coluna "Conta" ganha uma sombra: os meses passam por baixo dela. */
const scrolledX = ref(false)
const onScroll = () => (scrolledX.value = (scroller.value?.scrollLeft ?? 0) > 0)
const STICKY_EDGE =
  "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-3 after:translate-x-full after:bg-linear-to-r after:from-black/12 after:to-transparent after:opacity-0 after:transition-opacity after:content-['']"
const scrollToHighlight = () => {
  const el = scroller.value
  const column = el?.querySelector<HTMLElement>('[data-highlight]')
  if (el && column) el.scrollLeft = column.offsetLeft - el.clientWidth / 2
  onScroll()
}
onMounted(scrollToHighlight)
// Pela lista de meses, não pelo array: a análise refeita (outro regime, outra unidade) não deve desfazer a rolagem.
watch(() => props.highlight.join(), scrollToHighlight, { flush: 'post' })
</script>

<template>
  <ExpandablePanel v-slot="{ expanded: fullscreen, expand }" title="DRE completa" :subtitle="subtitle" class="flex flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <slot v-if="fullscreen" name="filters" />
        <SegmentedControl v-model="mode" :options="MODES" label="Exibir" />
        <MonthFilter v-if="report.periods.length > 1" v-model="shown" :periods="report.periods" />
      </div>
      <div class="flex items-center gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-body">
          <Checkbox :model-value="showZero" @update:model-value="showZero = $event === true" />
          Mostrar contas zeradas
        </label>
        <InfoTip :text="TABLE_INFO" label="Como ler a tabela" />
        <ExpandButton v-if="!fullscreen" title="Abrir a DRE em tela cheia" @click="expand" />
      </div>
    </div>

    <div
      ref="scroller"
      class="overflow-auto overscroll-contain"
      :class="fullscreen ? 'min-h-0 flex-1' : 'max-h-[70vh]'"
      @scroll.passive="onScroll"
    >
      <table class="text-sm" :class="compact ? 'mx-auto w-auto' : 'min-w-full'">
        <thead
          class="sticky top-0 z-10 text-left text-muted-foreground"
          :class="compact ? 'bg-card shadow-[inset_0_-1px_0_var(--border)]' : 'bg-muted'"
        >
          <tr>
            <th
              class="sticky left-0 z-10 px-3 py-2.5 font-normal"
              :class="[
                compact ? 'min-w-44 bg-card shadow-[inset_0_-1px_0_var(--border)] sm:min-w-80' : 'min-w-44 bg-muted sm:min-w-64',
                STICKY_EDGE,
                scrolledX && 'after:opacity-100',
              ]"
            >
              Conta
            </th>
            <th
              v-for="i in shown"
              :key="i"
              data-period
              :data-highlight="highlight.includes(i) ? '' : undefined"
              class="px-3 py-2.5 text-right font-normal figure whitespace-nowrap"
              :class="[compact && 'min-w-36 px-5']"
            >
              {{ formatPeriod(report.periods[i]!) }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="line in rows"
            :key="line.id"
            class="transition-colors duration-(--duration-fast)"
            :class="rowClass(line)"
          >
            <th
              scope="row"
              class="sticky left-0 z-1 px-3 text-left [font-weight:inherit] sm:whitespace-nowrap"
              :class="[band(line)?.bg ?? 'bg-card', band(line) ? 'py-2' : 'py-1.5', STICKY_EDGE, scrolledX && 'after:opacity-100']"
              :style="{ paddingLeft: `${0.75 + depth(line) * 1.25}rem` }"
            >
              <button
                v-if="hasChildren(line)"
                type="button"
                class="-ml-1 inline-flex items-center gap-1.5 rounded px-1 text-left hover:underline"
                :aria-expanded="expanded.has(line.id)"
                @click="toggle(line)"
              >
                <PhCaretRight
                  :size="12"
                  weight="bold"
                  class="transition-transform duration-(--duration-base) ease-out"
                  :class="expanded.has(line.id) && 'rotate-90'"
                  aria-hidden="true"
                />
                {{ prettifyLabel(line.label) }}
              </button>
              <span v-else>{{ prettifyLabel(line.label) }}</span>
            </th>
            <td
              v-for="i in shown"
              :key="i"
              class="px-3 text-right figure whitespace-nowrap"
              :class="[band(line) ? 'py-2' : 'py-1.5', compact && 'px-5']"
            >
              <button
                v-if="(line.values[i] ?? 0) !== 0 && canInspect(line)"
                type="button"
                class="-mx-1 rounded px-1 transition-colors duration-(--duration-fast) ease-out hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                :aria-label="`${cell(line, i)}: ver lançamentos de ${prettifyLabel(line.label)} em ${formatPeriod(report.periods[i]!)}`"
                @click="inspect(line, i)"
              >
                <span :data-alt="format(line, i, otherMode)" :class="CELL_TEXT">
                  <span class="[grid-area:1/1]">{{ cell(line, i) }}</span>
                </span>
              </button>
              <span v-else :data-alt="format(line, i, otherMode)" :class="CELL_TEXT">
                <span class="[grid-area:1/1]">{{ cell(line, i) }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppModal
      v-model:open="open"
      :title="breakdown ? prettifyLabel(breakdown.label) : ''"
      :subtitle="breakdown ? `${formatPeriodLong(breakdown.period)}, ${breakdown.basis.regime === 'accrual' ? 'lançamentos pela competência (data de emissão)' : 'lançamentos pela data de pagamento'}${breakdown.basis.unit ? `, ${breakdown.segment.label.toLowerCase()} ${breakdown.basis.unit}` : ''}` : ''"
    >
      <CellBreakdown v-if="breakdown" :breakdown="breakdown" />
    </AppModal>
  </ExpandablePanel>
</template>
