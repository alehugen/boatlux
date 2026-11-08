<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <section :id="id" tabindex="-1" class="scroll-mt-48 outline-none lg:scroll-mt-38">
    <slot />
  </section>
</template>
