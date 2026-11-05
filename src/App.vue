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
        class="sticky top-0 z-(--layer-header) h-16 border-b bg-background/90 backdrop-blur-md transition-colors duration-(--duration-base) ease-out"
        :class="scrolled ? 'border-strong' : 'border-border'"
      >
        <nav class="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
          <RouterLink :to="{ name: 'import' }" class="rounded-md text-lg font-bold tracking-tight">
            Boat <span class="text-marker-ink">Lux</span>
          </RouterLink>
          <ThemeToggle />
        </nav>
      </header>

      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>

      <AppFooter />
    </div>
  </TooltipProvider>
</template>
