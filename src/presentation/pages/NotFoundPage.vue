<script setup lang="ts">
import { Button } from '@/presentation/components/ui/button'
</script>

<template>
  <section class="page-fade mx-auto max-w-7xl space-y-4 px-4 py-16 sm:px-8">
    <p class="figure text-7xl text-muted-foreground" aria-hidden="true">404</p>
    <h1 class="text-4xl leading-tight">Página não encontrada</h1>
    <p class="text-body">Este endereço não existe. Volte para o início para importar a DRE.</p>
    <div class="pt-2">
      <Button as-child>
        <RouterLink :to="{ name: 'import' }">Ir para o início</RouterLink>
      </Button>
    </div>
  </section>
</template>
