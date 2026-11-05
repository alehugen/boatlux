<script setup lang="ts">
import { PhInfo } from '@phosphor-icons/vue'
import { Button } from '@/presentation/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/presentation/components/ui/tooltip'

withDefaults(defineProps<{ text: string; label?: string }>(), { label: 'Como esta informação é calculada' })
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        class="rounded-full text-muted-foreground hover:text-foreground"
        :aria-label="label"
        @click.stop.prevent
      >
        <PhInfo weight="bold" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top" align="end" :side-offset="6" class="max-w-72 text-left leading-relaxed">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>
