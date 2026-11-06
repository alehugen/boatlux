<script setup lang="ts">
/** Selo "No azul" / "No vermelho". Ao mudar de lado, entra de novo com um carimbo. */
withDefaults(defineProps<{ positive: boolean; size?: 'md' | 'sm' }>(), { size: 'md' })
</script>

<template>
  <Transition name="fade" mode="out-in">
    <span
      :key="String(positive)"
      class="inline-block animate-stamp rounded-sm tracking-wide"
      :class="[
        positive ? 'bg-water text-water-foreground' : 'bg-[#c4314b] text-white',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-[0.95rem]',
      ]"
    >
      {{ positive ? 'No azul' : 'No vermelho' }}
    </span>
  </Transition>
</template>
