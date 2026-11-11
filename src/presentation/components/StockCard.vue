<script setup lang="ts">
import { PhSailboat } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { SoldGroup, SoldItem, Stock, StockGroup } from '@/domain/stock'
import { formatCurrencyCompact, formatCurrencyWhole } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = defineProps<{ stock: Stock }>()

/** Na Boatlux, as embarcações começam com J (jet ski) ou L (lancha). */
const KINDS: Record<string, string> = { J: 'Jet ski', L: 'Lancha' }
const kindOf = (label: string) => KINDS[label.trim().charAt(0).toUpperCase()] ?? null

const kinds = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.stock.items) {
    const kind = kindOf(item.group)
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => ({ label, count }))
})

const groups = computed(() => [...props.stock.groups].sort((a, b) => b.total - a.total))
const largest = computed(() => Math.max(...groups.value.map((group) => group.total), 1))

const quotas = (count: number) => `${count} ${count === 1 ? 'cota' : 'cotas'}`
const joinList = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : (items[0] ?? '')

function range(values: readonly number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (values.length === 1) return `1 cota de ${formatCurrencyWhole(min)}`
  if (min === max) return `${quotas(values.length)} de ${formatCurrencyWhole(min)}`
  return `${quotas(values.length)}, de ${formatCurrencyWhole(min)} a ${formatCurrencyWhole(max)}`
}

function detail(group: StockGroup) {
  return group.items.length === 1 ? '1 cota' : range(group.items.map((item) => item.value))
}

// Cotas vendidas: o mesmo desenho, com o que a planilha anota sobre cada uma (upgrade ou troca) abaixo da barra.
const sold = computed(() => props.stock.sold)
const soldGroups = computed(() =>
  [...(sold.value?.groups ?? [])].sort((a, b) => b.total + b.exchanged - (a.total + a.exchanged)),
)
const soldLargest = computed(() => Math.max(...soldGroups.value.map((group) => group.total + group.exchanged), 1))

/** "L31 - 04" → "04": o número da cota dentro da embarcação. */
const quotaNumber = (item: SoldItem) => item.label.slice(item.group.length).replace(/^\s*-\s*/, '').trim()

function soldDetail(group: SoldGroup) {
  const sales = group.items.filter((item) => item.movement?.kind !== 'exchange')
  const exchanges = group.items.length - sales.length
  const parts = sales.length ? [range(sales.map((item) => item.value))] : []
  if (exchanges) parts.push(`${quotas(exchanges)} em troca`)
  return parts.join(' · ')
}

/** Uma frase por movimentação: "Grupo L20 fez upgrade para a L31 (cotas 01 e 04)". */
function movements(group: SoldGroup): string[] {
  const notes: string[] = []
  const byOrigin = new Map<string, SoldItem[]>()
  for (const item of group.items) {
    if (!item.movement) {
      if (item.note) notes.push(`${item.label}: ${item.note}`)
      continue
    }
    const key = `${item.movement.kind}:${item.movement.from}`
    byOrigin.set(key, [...(byOrigin.get(key) ?? []), item])
  }
  const which = (items: SoldItem[]) => {
    const numbers = items.map(quotaNumber).filter(Boolean)
    if (!numbers.length || items.length === group.items.length) return ''
    return ` (${numbers.length === 1 ? 'cota' : 'cotas'} ${joinList(numbers)})`
  }
  const sentences = [...byOrigin.values()].map((items) => {
    const { kind, from } = items[0]!.movement!
    if (kind === 'upgrade') return `Grupo ${from} fez upgrade para a ${group.label}${which(items)}.`
    return `Troca de embarcação${from ? ` com a ${from}` : ''}${which(items)}: não foi venda e fica fora do total vendido.`
  })
  return [...sentences, ...notes]
}

const INFO =
  'Cotas disponíveis na aba de estoque, agrupadas por embarcação (o código antes do traço, como L29 em "L29 - 03"). O valor total soma o valor de todas as cotas. Cotas que aparecem na lista de vendidas saem do estoque. Nas vendidas, o total não conta as trocas de embarcação, e a observação da planilha (upgrade ou troca) aparece abaixo de cada barra. Não muda com o período nem com o regime escolhidos no topo da página.'
</script>

<template>
  <article class="surface flex min-w-0 flex-col p-6" aria-labelledby="estoque-titulo">
    <header>
      <h3 id="estoque-titulo" class="flex items-center gap-2 text-lg text-foreground">
        <PhSailboat :size="22" class="text-primary" aria-hidden="true" />
        Estoque
        <InfoTip :text="INFO" />
      </h3>
      <p class="text-sm text-muted-foreground">Cotas disponíveis para venda</p>
    </header>

    <dl class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <dt class="text-sm text-muted-foreground">Valor em estoque</dt>
        <dd class="text-[1.75rem] leading-tight figure text-foreground">{{ formatCurrencyCompact(stock.total) }}</dd>
      </div>
      <div>
        <dt class="text-sm text-muted-foreground">Cotas</dt>
        <dd class="text-xl leading-tight figure text-foreground">{{ stock.items.length }}</dd>
      </div>
      <div v-if="kinds.length">
        <dt class="text-sm text-muted-foreground">Por tipo</dt>
        <dd class="text-sm leading-snug text-foreground">
          <span v-for="kind in kinds" :key="kind.label" class="block">
            <span class="figure">{{ kind.count }}</span> {{ kind.count === 1 ? kind.label.toLowerCase() : `${kind.label.toLowerCase()}s` }}
          </span>
        </dd>
      </div>
    </dl>

    <ul v-if="groups.length" class="mt-6 space-y-4 border-t border-border pt-5">
      <li v-for="group in groups" :key="group.label">
        <div class="flex items-baseline justify-between gap-3">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate text-foreground">{{ group.label }}</span>
            <span v-if="kindOf(group.label)" class="rounded-sm bg-water-soft px-1.5 py-0.5 text-xs text-foreground">
              {{ kindOf(group.label) }}
            </span>
          </span>
          <span class="figure whitespace-nowrap text-foreground">{{ formatCurrencyWhole(group.total) }}</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${(group.total / largest) * 100}%` }" />
        </div>
        <p class="mt-1 text-sm text-muted-foreground">{{ detail(group) }}</p>
      </li>
    </ul>

    <section v-if="sold" class="mt-6 border-t border-border pt-5" aria-labelledby="vendidas-titulo">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 id="vendidas-titulo" class="text-base text-foreground">Cotas vendidas</h4>
        <p class="text-sm text-muted-foreground">
          <span class="figure text-foreground">{{ formatCurrencyWhole(sold.total) }}</span>
          em {{ quotas(sold.sales) }}
        </p>
      </div>

      <ul class="mt-4 space-y-4" data-sold>
        <li v-for="group in soldGroups" :key="group.label">
          <div class="flex items-baseline justify-between gap-3">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-foreground">{{ group.label }}</span>
              <span v-if="kindOf(group.label)" class="rounded-sm bg-water-soft px-1.5 py-0.5 text-xs text-foreground">
                {{ kindOf(group.label) }}
              </span>
            </span>
            <span v-if="group.total" class="figure whitespace-nowrap text-foreground">{{ formatCurrencyWhole(group.total) }}</span>
            <span v-else class="figure whitespace-nowrap text-muted-foreground" title="Troca de embarcação: fora do total vendido">
              {{ formatCurrencyWhole(group.exchanged) }}
            </span>
          </div>
          <div class="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${(group.total / soldLargest) * 100}%` }" />
            <div class="h-full rounded-full bg-muted-foreground/40" :style="{ width: `${(group.exchanged / soldLargest) * 100}%` }" />
          </div>
          <p class="mt-1 text-sm text-muted-foreground">{{ soldDetail(group) }}</p>
          <p v-for="text in movements(group)" :key="text" class="mt-0.5 text-sm text-body">{{ text }}</p>
        </li>
      </ul>
    </section>
  </article>
</template>
