<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <!-- Folga abaixo da área fixa do topo (o scroll-padding da página): no celular, inclui a faixa do menu de seções. -->
  <section :id="id" tabindex="-1" class="scroll-mt-16 outline-none lg:scroll-mt-6">
    <slot />
  </section>
</template>
