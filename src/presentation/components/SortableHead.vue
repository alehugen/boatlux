<script setup lang="ts">
import { PhCaretDown, PhCaretUp, PhCaretUpDown } from '@phosphor-icons/vue'
import { computed, type HTMLAttributes } from 'vue'
import { cn } from 'cn'
import { TableHead } from '@/presentation/components/ui/table'
import type { TableSort } from '@/presentation/composables/useTableSort'

const props = defineProps<{
  sort: TableSort
  column: string
  align?: 'left' | 'right'
  class?: HTMLAttributes['class']
}>()

const active = computed(() => props.sort.key === props.column)
const icon = computed(() => {
  if (!active.value) return PhCaretUpDown
  return props.sort.direction === 'asc' ? PhCaretUp : PhCaretDown
})
</script>

<template>
  <TableHead :class="cn('p-0', props.class)" :aria-sort="sort.ariaSort(column)">
    <button
      type="button"
      :class="
        cn(
          'flex h-full min-h-10 w-full cursor-pointer items-center py-2 font-medium whitespace-nowrap transition-colors duration-(--duration-fast) ease-out hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          align === 'right' ? 'justify-end ps-4 pe-3 text-right' : 'justify-start ps-3 pe-4 text-left',
        )
      "
      @click="sort.toggle(column)"
    >
      <span class="relative">
        <slot />
        <component
          :is="icon"
          :size="12"
          weight="bold"
          aria-hidden="true"
          class="absolute top-1/2 -translate-y-1/2"
          :class="[align === 'right' ? 'right-full mr-0.5' : 'left-full ml-0.5', active ? 'text-current' : 'text-muted-foreground/70']"
        />
      </span>
    </button>
  </TableHead>
</template>
