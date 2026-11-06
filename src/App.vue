<script setup lang="ts">
import AppFooter from '@/presentation/components/AppFooter.vue'
import ThemeToggle from '@/presentation/components/ThemeToggle.vue'
import { TooltipProvider } from '@/presentation/components/ui/tooltip'
import { useScrolled } from '@/presentation/composables/useScroll'

const scrolled = useScrolled()
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
      </header>

      <main class="flex-1">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in" :duration="{ enter: 560, leave: 180 }">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>

      <AppFooter />
    </div>
  </TooltipProvider>
</template>
