<script setup lang="ts">
import InfoTip from './InfoTip.vue'

defineProps<{ title: string; subtitle?: string; info?: string }>()
</script>

<template>
  <div>
    <h2 class="flex items-center gap-1 text-2xl font-semibold tracking-tight">
      {{ title }}
      <InfoTip v-if="info" :text="info" />
    </h2>
    <p v-if="subtitle" class="text-muted-foreground">{{ subtitle }}</p>
  </div>
</template>
