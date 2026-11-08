<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import { useScrollSpy } from '@/presentation/composables/useScroll'

export interface NavSection {
  id: string
  label: string
}

/**
 * Menu das seções da DRE. No desktop é uma coluna fixa ao lado do conteúdo; no celular, uma faixa
 * horizontal fixa logo abaixo da barra de filtros. A seção na tela fica destacada.
 */
const props = defineProps<{ sections: readonly NavSection[] }>()
const { activeId, scrollTo } = useScrollSpy(() => props.sections.map((section) => section.id))

/** Na faixa horizontal, mantém o item ativo à vista. */
const list = useTemplateRef('list')
watch(activeId, async (id) => {
  await nextTick()
  const item = list.value?.querySelector<HTMLElement>(`[data-section="${id}"]`)
  if (!item || !list.value || list.value.scrollWidth <= list.value.clientWidth) return
  list.value.scrollTo({ left: item.offsetLeft - list.value.clientWidth / 2 + item.offsetWidth / 2, behavior: 'smooth' })
})
</script>

<template>
  <nav
    aria-label="Seções da página"
    class="sticky top-32 z-(--layer-raised) -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-38 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
  >
    <p class="mb-3 hidden text-sm text-muted-foreground lg:block">Nesta página</p>
    <ul
      ref="list"
      class="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-border"
    >
      <li v-for="section in sections" :key="section.id" class="shrink-0">
        <a
          :href="`#${section.id}`"
          :data-section="section.id"
          :aria-current="section.id === activeId ? 'location' : undefined"
          class="block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-(--duration-base) ease-out lg:-ml-px lg:rounded-none lg:border-l-2 lg:py-2 lg:pl-4"
          :class="
            section.id === activeId
              ? 'bg-accent text-accent-foreground lg:border-primary lg:bg-transparent lg:text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground lg:border-transparent lg:hover:border-border lg:hover:bg-transparent'
          "
          @click.prevent="scrollTo(section.id)"
        >
          {{ section.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>
