<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useScrollSpy } from '@/presentation/composables/useScroll'

export interface NavSection {
  id: string
  label: string
  nested?: boolean
}

const props = defineProps<{ sections: readonly NavSection[] }>()

const { activeId, scrollTo } = useScrollSpy(() => props.sections.map((section) => section.id))

const list = useTemplateRef('list')
const indicator = ref({ top: 0, height: 0, visible: false })

const activeIndex = computed(() => props.sections.findIndex((section) => section.id === activeId.value))

watch(
  [activeIndex, () => props.sections.length],
  async () => {
    await nextTick()
    const item = list.value?.querySelectorAll<HTMLElement>('[data-nav-item]')[activeIndex.value]
    if (!item || !list.value) {
      indicator.value = { ...indicator.value, visible: false }
      return
    }
    indicator.value = { top: item.offsetTop, height: item.offsetHeight, visible: true }
    list.value.scrollTo({ left: item.offsetLeft - list.value.clientWidth / 2 + item.offsetWidth / 2, behavior: 'smooth' })
  },
  { immediate: true },
)
</script>

<template>
  <nav
    aria-label="Seções da página"
    class="sticky top-16 z-(--layer-nav) -mx-4 min-w-0 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-md lg:top-24 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
  >
    <div class="flex items-center gap-3 lg:block">
      <div v-if="$slots.controls" class="shrink-0 lg:mb-8">
        <slot name="controls" />
      </div>
      <p class="mb-3 hidden text-sm font-medium text-muted-foreground lg:block">Nesta página</p>
      <ul
        ref="list"
        class="relative flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-border"
      >
        <span
          aria-hidden="true"
          class="absolute -left-px hidden w-[3px] rounded-full bg-primary transition-[transform,height,opacity] duration-(--duration-slow) ease-out lg:block"
          :style="{
            transform: `translateY(${indicator.top}px)`,
            height: `${indicator.height}px`,
            opacity: indicator.visible ? 1 : 0,
          }"
        />
        <li v-for="section in sections" :key="section.id" data-nav-item class="shrink-0">
          <a
            :href="`#${section.id}`"
            :aria-current="section.id === activeId ? 'location' : undefined"
            class="block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-(--duration-base) ease-out lg:rounded-none lg:rounded-r-md lg:py-1.5"
            :class="[
              section.nested && 'lg:pl-6 lg:text-[0.8125rem]',
              section.id === activeId
                ? 'bg-accent font-medium text-accent-foreground lg:bg-transparent lg:text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground lg:hover:bg-transparent',
            ]"
            @click.prevent="scrollTo(section.id)"
          >
            {{ section.label }}
          </a>
        </li>
      </ul>
    </div>
  </nav>
</template>
