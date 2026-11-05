<script setup lang="ts" generic="T extends string">
import { ToggleGroup, ToggleGroupItem } from '@/presentation/components/ui/toggle-group'

withDefaults(
  defineProps<{
    options: readonly { value: T; label: string }[]
    label: string
    size?: 'sm' | 'default'
  }>(),
  { size: 'default' },
)

const model = defineModel<T>({ required: true })

function select(value: unknown) {
  if (typeof value === 'string' && value) model.value = value as T
}
</script>

<template>
  <ToggleGroup
    type="single"
    :model-value="model"
    :size="size"
    :aria-label="label"
    class="rounded-lg bg-muted p-0.5"
    @update:model-value="select"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="rounded-md! text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card dark:data-[state=on]:bg-strong"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
