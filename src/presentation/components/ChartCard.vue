<script setup lang="ts">
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/presentation/components/ui/card'
import InfoTip from './InfoTip.vue'

defineProps<{ title: string; subtitle?: string; info?: string }>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ title }}</CardTitle>
      <CardDescription v-if="subtitle">{{ subtitle }}</CardDescription>
      <CardAction v-if="info" class="-mt-1 -mr-2">
        <InfoTip :text="info" />
      </CardAction>
    </CardHeader>
    <CardContent>
      <slot />
    </CardContent>
  </Card>
</template>
