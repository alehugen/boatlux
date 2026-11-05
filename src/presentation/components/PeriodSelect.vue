<script setup lang="ts">
import { PhCalendarBlank } from '@phosphor-icons/vue'
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

defineProps<{ groups: readonly PeriodGroup[] }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-col gap-1.5 text-sm">
    <span id="periodo" class="hidden font-medium text-muted-foreground lg:block">Período</span>
    <Select v-model="model">
      <SelectTrigger aria-labelledby="periodo" class="w-36 bg-card shadow-card lg:w-full">
        <PhCalendarBlank class="text-muted-foreground" aria-hidden="true" />
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
