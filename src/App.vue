<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AppFooter from '@/presentation/components/AppFooter.vue'
import LoaderTrack from '@/presentation/components/LoaderTrack.vue'
import ThemeToggle from '@/presentation/components/ThemeToggle.vue'
import { TooltipProvider } from '@/presentation/components/ui/tooltip'
import { useReport } from '@/presentation/composables/useReport'
import { finishPageLoading, pageEntering, pageLeaving, usePageLoading } from '@/presentation/composables/usePageLoading'
import { useScrolled } from '@/presentation/composables/useScroll'

const scrolled = useScrolled()
const { swapping, busy } = usePageLoading()
const { isImporting } = useReport()
const working = computed(() => busy.value || isImporting.value)

onMounted(finishPageLoading)
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="flex min-h-screen flex-col">
      <header
        class="sticky top-0 z-(--layer-header) h-18 bg-band text-band-foreground transition-shadow duration-(--duration-base) ease-out"
        :class="scrolled && 'shadow-floating'"
      >
        <nav class="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <RouterLink :to="{ name: 'import' }" class="rounded-sm" aria-label="Boat Lux, página inicial">
            <img src="/brand/logo-white.png" alt="" width="133" height="36" class="h-9 w-auto" />
          </RouterLink>
          <ThemeToggle />
        </nav>
        <LoaderTrack
          :active="working"
          class="absolute inset-x-0 bottom-0 h-0.5"
          :label="isImporting ? 'Importando a planilha' : 'Carregando a página'"
        />
      </header>

      <main class="relative flex-1">
        <Transition name="fade">
          <div
            v-if="swapping"
            class="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-80 items-center justify-center"
          >
            <div class="flex flex-col items-center gap-5">
              <img src="/brand/logo-white.png" alt="" width="160" height="43" class="h-11 w-auto opacity-90" />
              <LoaderTrack active class="h-0.5 w-32 rounded-full bg-band-border" label="Carregando a página" />
            </div>
          </div>
        </Transition>

        <RouterView v-slot="{ Component, route }">
          <Transition
            name="page"
            mode="out-in"
            :duration="{ enter: 560, leave: 180 }"
            @before-leave="pageLeaving"
            @before-enter="pageEntering"
            @after-enter="finishPageLoading"
          >
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>

      <AppFooter />
    </div>
  </TooltipProvider>
</template>
