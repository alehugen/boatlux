<script setup lang="ts">
import { PhChartBar } from '@phosphor-icons/vue'
</script>

<template>
  <div class="flex h-40 flex-col items-center justify-center gap-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
    <PhChartBar :size="24" weight="duotone" aria-hidden="true" />
    Sem dados para exibir neste período.
  </div>
</template>
