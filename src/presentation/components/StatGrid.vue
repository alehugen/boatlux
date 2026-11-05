<script setup lang="ts">
defineProps<{ columns: string }>()
</script>

<template>
  <div class="grid gap-3" :class="columns">
    <slot />
  </div>
</template>
