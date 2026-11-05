<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import { useId, useTemplateRef, watch } from 'vue'
import { Button } from '@/presentation/components/ui/button'
import { useModal } from '@/presentation/composables/useModal'

defineProps<{ title: string; subtitle?: string }>()
const open = defineModel<boolean>('open', { required: true })

const titleId = useId()
const closeButton = useTemplateRef('closeButton')
const modal = useModal({
  focusOnOpen: () => closeButton.value?.$el,
  onEscape: () => (open.value = false),
})
const { state, zIndex } = modal

watch(open, (isOpen) => (isOpen ? modal.open() : modal.close()), { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state !== 'closed'"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :style="{ zIndex }"
      class="fixed inset-0 flex items-center justify-center p-3 sm:p-8"
    >
      <div
        class="absolute inset-0 bg-[rgb(8_6_28/0.62)] backdrop-blur-sm"
        :class="state === 'closing' ? 'animate-backdrop-out' : 'animate-backdrop-in'"
        aria-hidden="true"
        @click="open = false"
      />
      <div
        class="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-card shadow-floating"
        :class="state === 'closing' ? 'animate-modal-out' : 'animate-modal-in'"
      >
        <div class="flex items-center justify-between gap-4 border-b px-5 py-3">
          <div class="min-w-0">
            <h2 :id="titleId" class="text-xl font-semibold tracking-tight">{{ title }}</h2>
            <p v-if="subtitle" class="truncate text-sm text-muted-foreground">{{ subtitle }}</p>
          </div>
          <Button ref="closeButton" variant="ghost" size="icon" aria-label="Fechar" title="Fechar (Esc)" @click="open = false">
            <PhX weight="bold" aria-hidden="true" />
          </Button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
