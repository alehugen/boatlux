<script setup lang="ts">
import { PhLinkedinLogo } from '@phosphor-icons/vue'

const LINKEDIN_URL = 'https://www.linkedin.com/in/alehugen'
</script>

<template>
  <footer class="mt-20 border-t border-border">
    <div
      class="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-6 sm:px-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        <span class="font-bold text-foreground">Boat <span class="text-marker-ink">Lux</span></span>
        processa a planilha só no navegador.
      </p>
      <p class="flex items-center gap-1">
        Feito por
        <a
          :href="LINKEDIN_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-body transition-colors hover:bg-muted hover:text-foreground"
        >
          <PhLinkedinLogo :size="16" weight="fill" aria-hidden="true" />
          Alessandro Hugen
          <span class="sr-only">(LinkedIn, abre em nova aba)</span>
        </a>
      </p>
    </div>
  </footer>
</template>
