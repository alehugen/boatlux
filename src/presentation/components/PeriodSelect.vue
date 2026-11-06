<script setup lang="ts">
import { PhCalendarBlank } from '@phosphor-icons/vue'
import { useId } from 'vue'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

export interface PeriodGroup {
  label: string
  options: readonly { key: string; label: string }[]
}

/** Seletor de período sobre a faixa marinho. `compact` esconde o rótulo (barra fixa). */
withDefaults(defineProps<{ groups: readonly PeriodGroup[]; compact?: boolean }>(), { compact: false })
const model = defineModel<string>({ required: true })
const labelId = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5 text-sm">
    <span :id="labelId" :class="compact ? 'sr-only' : 'text-band-muted'">Período</span>
    <Select v-model="model">
      <SelectTrigger
        :aria-labelledby="labelId"
        class="w-44 border-band-border bg-transparent text-band-foreground transition-colors duration-(--duration-fast) hover:border-band-muted hover:bg-white/5 data-[size=default]:h-10 dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-band-muted"
        :class="compact && 'data-[size=default]:h-9'"
      >
        <PhCalendarBlank aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup v-for="group in groups.filter((g) => g.options.length)" :key="group.label">
          <SelectLabel>{{ group.label }}</SelectLabel>
          <SelectItem v-for="option in group.options" :key="option.key" :value="option.key">{{ option.label }}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
