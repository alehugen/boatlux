<script setup lang="ts">
import { PhWarning } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { OutsideGroup, OutsideReason } from '@/domain/dre'
import { sum } from '@/domain/shared'
import { formatCurrency, formatCurrencyCompact } from '@/presentation/format'

/** Lançamentos do fluxo de caixa que a DRE deixa de fora, com o motivo, para corrigir na planilha. */
const props = defineProps<{ groups: readonly OutsideGroup[]; when: string }>()

const REASONS: Record<OutsideReason, { title: string; fix: string }> = {
  'no-category': {
    title: 'Sem categoria',
    fix: 'A classificação do lançamento não está na aba Lista, então a coluna Categoria fica vazia. Cadastre a classificação na Lista.',
  },
  'unknown-category': {
    title: 'Categoria fora da DRE',
    fix: 'A categoria não é o nome de nenhuma conta da DRE Geral (maiúsculas não importam, acentos e espaços sim).',
  },
  'no-issue-date': {
    title: 'Sem data de emissão',
    fix: 'Na competência, o mês vem da data de emissão. Lançamentos pagos no período sem essa data ficam de fora.',
  },
}

const count = computed(() => sum(props.groups.map((group) => group.count)))
const total = computed(() => sum(props.groups.map((group) => group.total)))
const sections = computed(() =>
  (Object.keys(REASONS) as OutsideReason[])
    .map((reason) => ({ reason, ...REASONS[reason], groups: props.groups.filter((group) => group.reason === reason) }))
    .filter((section) => section.groups.length),
)
const plural = (n: number) => (n === 1 ? 'lançamento' : 'lançamentos')
</script>

<template>
  <details v-if="groups.length" class="surface group border-l-4 border-l-destructive px-4 py-3 text-sm text-body">
    <summary class="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
      <PhWarning :size="18" weight="fill" class="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
      <span>
        <span class="text-foreground">
          {{ count }} {{ plural(count) }} ({{ formatCurrencyCompact(total) }}) {{ when }} não {{ count === 1 ? 'entra' : 'entram' }} na DRE.
        </span>
        <span class="text-muted-foreground group-open:hidden"> Ver quais</span>
      </span>
    </summary>

    <div class="mt-3 space-y-4 pl-6">
      <section v-for="section in sections" :key="section.reason">
        <h3 class="text-foreground">{{ section.title }}</h3>
        <p class="text-muted-foreground">{{ section.fix }}</p>
        <ul class="mt-2 divide-y divide-border">
          <li v-for="group in section.groups" :key="group.label" class="flex justify-between gap-4 py-1.5">
            <span class="min-w-0 truncate" :title="group.label">{{ group.label }}</span>
            <span class="figure whitespace-nowrap" :class="group.total < 0 && 'text-destructive'">
              {{ group.count }} {{ plural(group.count) }}, {{ formatCurrency(group.total) }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </details>
</template>
