<script setup lang="ts">
import InfoTip from './InfoTip.vue'

defineProps<{ title: string; subtitle?: string; info?: string }>()
</script>

<template>
  <figure class="surface min-w-0 p-6">
    <figcaption class="mb-4">
      <span class="flex items-center gap-1 text-lg text-foreground">
        {{ title }}
        <InfoTip v-if="info" :text="info" />
      </span>
      <span v-if="subtitle" class="block text-sm text-muted-foreground">{{ subtitle }}</span>
    </figcaption>
    <slot />
  </figure>
</template>
