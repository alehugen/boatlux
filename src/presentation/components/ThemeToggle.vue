<script setup lang="ts">
import { PhDesktop, PhMoon, PhSun } from '@phosphor-icons/vue'
import { nextTick } from 'vue'
import { ToggleGroup, ToggleGroupItem } from '@/presentation/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/presentation/components/ui/tooltip'
import { ThemePreference, useTheme } from '@/presentation/composables/useTheme'

const { preference } = useTheme()

const OPTIONS = [
  { value: ThemePreference.Light, label: 'Tema claro', icon: PhSun },
  { value: ThemePreference.Dark, label: 'Tema escuro', icon: PhMoon },
  { value: ThemePreference.System, label: 'Seguir o sistema', icon: PhDesktop },
]

function select(value: unknown) {
  const option = OPTIONS.find((o) => o.value === value)
  if (!option || option.value === preference.value) return
  const apply = () => {
    preference.value = option.value
    return nextTick()
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if ('startViewTransition' in document && !reducedMotion) document.startViewTransition(apply)
  else apply()
}
</script>

<template>
  <ToggleGroup
    type="single"
    size="sm"
    :model-value="preference"
    aria-label="Tema"
    class="rounded-lg bg-muted p-0.5"
    @update:model-value="select"
  >
    <Tooltip v-for="option in OPTIONS" :key="option.value">
      <TooltipTrigger as-child>
        <ToggleGroupItem
          :value="option.value"
          :aria-label="option.label"
          class="rounded-md! px-2 text-muted-foreground transition-[color,background-color,box-shadow] duration-(--duration-base) ease-out hover:bg-transparent hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-card dark:aria-pressed:bg-strong"
        >
          <component
            :is="option.icon"
            :weight="preference === option.value ? 'fill' : 'regular'"
            class="transition-transform duration-(--duration-slow) ease-spring"
            :class="preference === option.value && 'scale-110'"
            aria-hidden="true"
          />
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="bottom" :side-offset="6">{{ option.label }}</TooltipContent>
    </Tooltip>
  </ToggleGroup>
</template>
