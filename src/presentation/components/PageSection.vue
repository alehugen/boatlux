<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <section :id="id" tabindex="-1" class="scroll-mt-32 outline-none lg:scroll-mt-24">
    <slot />
  </section>
</template>
