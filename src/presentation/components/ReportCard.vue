<script setup lang="ts">
import { PhFileText, PhTrash } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Button } from '@/presentation/components/ui/button'
import { Card, CardFooter } from '@/presentation/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/presentation/components/ui/tooltip'

withDefaults(
  defineProps<{ title: string; subtitle: string; to: RouteLocationRaw; removable?: boolean; icon?: Component }>(),
  { removable: false, icon: () => PhFileText },
)
defineEmits<{ remove: [] }>()
</script>

<template>
  <Card class="group/report card-interactive gap-0 py-0">
    <div class="flex items-start gap-3 p-5">
      <component :is="icon" :size="28" weight="duotone" class="mt-0.5 shrink-0 text-muted-foreground transition-colors duration-(--duration-base) ease-out group-hover/report:text-foreground" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-lg font-semibold">{{ title }}</h3>
        <p class="text-sm text-muted-foreground">{{ subtitle }}</p>
        <div v-if="$slots.default" class="relative z-10 mt-4">
          <slot />
        </div>
      </div>
    </div>

    <CardFooter class="justify-between gap-2 border-t border-border px-5 py-3">
      <Tooltip v-if="removable">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="relative z-10 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
            :aria-label="`Remover ${title}`"
            @click="$emit('remove')"
          >
            <PhTrash aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remover</TooltipContent>
      </Tooltip>
      <span v-else />

      <Button as-child class="px-4 group-hover/report:shadow-primary">
        <RouterLink :to="to" :aria-label="`Visualizar ${title}`" class="after:absolute after:inset-0 after:content-['']">
          Visualizar
        </RouterLink>
      </Button>
    </CardFooter>
  </Card>
</template>
