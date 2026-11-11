<script setup lang="ts">
import { PhInfo } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { Button } from '@/presentation/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/presentation/components/ui/tooltip'

withDefaults(defineProps<{ text: string; label?: string; onBand?: boolean }>(), {
  label: 'Como esta informação é calculada',
  onBand: false,
})

/** Abre também com toque e clique (no celular não há "passar o mouse"); fecha ao tocar fora ou com Esc. */
const open = ref(false)
</script>

<template>
  <Tooltip v-model:open="open" disable-closing-trigger>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        :class="[
          'rounded-full',
          onBand
            ? 'text-band-muted hover:bg-band-border hover:text-band-foreground'
            : 'text-muted-foreground hover:text-foreground',
        ]"
        :aria-label="label"
        @click.stop.prevent="open = !open"
      >
        <PhInfo weight="bold" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top" align="end" :side-offset="6" class="max-w-72 text-left leading-relaxed">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>
