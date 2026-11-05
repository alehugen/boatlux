<script setup lang="ts">
import { PhArrowsOut } from '@phosphor-icons/vue'
import { Button } from '@/presentation/components/ui/button'

defineProps<{ title: string }>()
</script>

<template>
  <Button data-expand variant="outline" size="icon" aria-label="Abrir em tela cheia" :title="title">
    <PhArrowsOut weight="bold" aria-hidden="true" />
  </Button>
</template>
