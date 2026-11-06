<script setup lang="ts">
import InfoTip from './InfoTip.vue'

defineProps<{ title: string; subtitle?: string; info?: string }>()
</script>

<template>
  <div>
    <h2 class="flex items-center gap-1 text-[1.5625rem] leading-tight">
      {{ title }}
      <InfoTip v-if="info" :text="info" />
    </h2>
    <p v-if="subtitle" class="mt-1 text-muted-foreground">{{ subtitle }}</p>
  </div>
</template>
