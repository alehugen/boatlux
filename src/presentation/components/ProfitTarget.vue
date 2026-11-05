<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ProfitTargetBase } from '@/application'
import CalculationSlide from '@/presentation/components/profit-target/CalculationSlide.vue'
import ComparisonSlide from '@/presentation/components/profit-target/ComparisonSlide.vue'
import LinesSlide from '@/presentation/components/profit-target/LinesSlide.vue'
import OverviewSlide from '@/presentation/components/profit-target/OverviewSlide.vue'
import PathsSlide from '@/presentation/components/profit-target/PathsSlide.vue'
import ExpandablePanel from '@/presentation/components/ExpandablePanel.vue'
import ExpandButton from '@/presentation/components/ExpandButton.vue'
import SegmentedControl from '@/presentation/components/SegmentedControl.vue'
import { Button } from '@/presentation/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'
import { PROFIT_TARGETS, useProfitTarget } from '@/presentation/composables/useProfitTarget'
import { formatCurrencyCompact, formatPercent, prettifyLabel } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  reference: string
  source: string
  revenueOptions: readonly { value: string; label: string }[]
}>()
const revenue = defineModel<string>('revenue', { required: true })
const revenueName = computed(() => (props.base.revenueLabel ? prettifyLabel(props.base.revenueLabel) : 'Receita bruta'))
const { target, projection } = useProfitTarget(() => props.base)

const options = PROFIT_TARGETS.map((value) => ({ value: String(value), label: formatCurrencyCompact(value) }))
const selected = computed({
  get: () => String(target.value),
  set: (value: string) => (target.value = Number(value)),
})

const STEPS = ['Resultado', 'Hoje × meta', 'Como calculamos', 'Linha a linha', 'Caminhos e sugestões'] as const
const step = ref(0)
const headings = ref<(HTMLElement | null)[]>([])

async function goTo(index: number) {
  if (index === step.value || index < 0 || index >= STEPS.length) return
  step.value = index
  await nextTick()
  headings.value[index]?.focus({ preventScroll: true })
}

const slideState = (index: number) => (index === step.value ? 'active' : index < step.value ? 'before' : 'after')
const SLIDE_CLASSES = {
  active: 'visible translate-x-0 opacity-100',
  before: 'invisible -translate-x-8 opacity-0',
  after: 'invisible translate-x-8 opacity-0',
}
</script>

<template>
  <ExpandablePanel v-slot="{ expanded, expand }" title="Meta de lucro" :subtitle="source">
    <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b px-5 py-4">
      <div v-if="revenueOptions.length > 2" class="flex flex-col gap-1.5">
        <span id="meta-receita" class="text-sm font-medium">Receita considerada</span>
        <Select v-model="revenue">
          <SelectTrigger aria-labelledby="meta-receita" class="w-56 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in revenueOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Lucro desejado por mês</span>
        <SegmentedControl v-model="selected" :options="options" label="Lucro desejado por mês" size="sm" class="flex-wrap" />
      </div>
      <ExpandButton v-if="!expanded" class="ml-auto self-end" title="Abrir em tela cheia para apresentar" @click="expand" />
    </div>

    <div v-if="projection.status === 'unreachable'" class="max-w-prose space-y-2 p-6" aria-live="polite">
      <p class="text-lg font-semibold text-destructive">Vender mais não leva a essa meta</p>
      <p class="text-body">
        A margem de contribuição está em {{ formatPercent(base.contributionRatio) }}: os custos variáveis já consomem toda
        a receita, então cada venda a mais aumenta o prejuízo. Antes de buscar faturamento, é preciso rever preços ou
        custos variáveis.
      </p>
    </div>

    <template v-else>
      <nav aria-label="Etapas da meta de lucro" class="border-b px-5 py-3">
        <ol class="flex flex-wrap gap-2">
          <li v-for="(label, index) in STEPS" :key="label">
            <button
              type="button"
              class="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors duration-(--duration-fast) ease-out"
              :class="step === index ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground'"
              :aria-current="step === index ? 'step' : undefined"
              @click="goTo(index)"
            >
              <span
                class="grid size-6 place-items-center rounded-full text-xs font-semibold figure transition-colors duration-(--duration-fast) ease-out"
                :class="step === index ? 'bg-primary text-primary-foreground' : 'bg-muted'"
                aria-hidden="true"
                >{{ index + 1 }}</span
              >
              {{ label }}
            </button>
          </li>
        </ol>
      </nav>

      <div
        class="grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
        :class="expanded ? 'min-h-0 flex-1' : 'max-h-[max(24rem,calc(100dvh-26rem))]'"
        @keydown.left="goTo(step - 1)"
        @keydown.right="goTo(step + 1)"
      >
        <section
          v-for="(label, index) in STEPS"
          :key="label"
          class="min-w-0 overflow-y-auto overscroll-contain p-6 transition-[opacity,translate,visibility] duration-(--duration-base) ease-out [grid-area:1/1]"
          :class="SLIDE_CLASSES[slideState(index)]"
          :data-active="index === step"
          :inert="index !== step"
          :aria-labelledby="`meta-passo-${index}`"
        >
          <h3
            :id="`meta-passo-${index}`"
            :ref="(el) => (headings[index] = el as HTMLElement | null)"
            tabindex="-1"
            class="text-lg font-semibold outline-none"
            :class="index === 0 && 'sr-only'"
          >
            {{ label }}
          </h3>

          <OverviewSlide v-if="index === 0" :base :projection :reference :revenue-name="revenueName" />
          <ComparisonSlide v-else-if="index === 1" :base :projection :reference :revenue-name="revenueName" />
          <CalculationSlide v-else-if="index === 2" :base :projection :reference :source :revenue-name="revenueName" />
          <LinesSlide v-else-if="index === 3" :base :projection :reference :revenue-name="revenueName" />
          <PathsSlide v-else :base :projection :reference />
        </section>
      </div>

      <div class="flex items-center justify-between gap-3 border-t px-5 py-3">
        <Button variant="ghost" :disabled="step === 0" @click="goTo(step - 1)">Anterior</Button>
        <p class="text-sm text-muted-foreground figure" aria-live="polite">{{ step + 1 }} de {{ STEPS.length }}</p>
        <Button v-if="step < STEPS.length - 1" variant="outline" @click="goTo(step + 1)">
          <span class="sm:hidden">Próximo</span>
          <span class="hidden sm:inline">Próximo: {{ STEPS[step + 1] }}</span>
        </Button>
        <Button v-else variant="outline" @click="goTo(0)">Voltar ao início</Button>
      </div>
    </template>
  </ExpandablePanel>
</template>
