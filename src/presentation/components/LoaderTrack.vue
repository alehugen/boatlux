<script setup lang="ts">
/**
 * Indicador de carregamento indeterminado: um trecho ciano correndo num trilho.
 * Só aparece depois de um instante, para não piscar em carregamentos rápidos.
 */
defineProps<{ active: boolean; label: string }>()
</script>

<template>
  <div
    class="overflow-hidden transition-opacity duration-(--duration-base) ease-out"
    :class="active ? 'opacity-100 delay-150' : 'opacity-0'"
    :role="active ? 'progressbar' : undefined"
    :aria-label="active ? label : undefined"
    :aria-hidden="!active"
  >
    <div
      class="h-full w-1/3 rounded-full bg-water motion-reduce:w-full motion-reduce:opacity-60"
      :class="active && 'animate-loader motion-reduce:animate-none'"
    />
  </div>
</template>
