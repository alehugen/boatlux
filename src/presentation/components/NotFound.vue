<script setup lang="ts">
withDefaults(defineProps<{ message: string; description?: string; action?: string }>(), {
  description: 'Os dados ficam só na memória do navegador. Depois de recarregar a página, importe os arquivos de novo.',
  action: 'Voltar ao início',
})
</script>

<template>
  <div class="max-w-xl space-y-3 py-8">
    <h1 class="text-3xl font-bold tracking-tight">{{ message }}</h1>
    <p class="text-body">{{ description }}</p>
    <RouterLink :to="{ name: 'import' }" class="link">{{ action }}</RouterLink>
  </div>
</template>
