<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import { cn } from 'cn'
import { useId, useTemplateRef, type HTMLAttributes } from 'vue'
import { Button } from '@/presentation/components/ui/button'
import { useModal } from '@/presentation/composables/useModal'

const props = defineProps<{ title: string; subtitle?: string; class?: HTMLAttributes['class'] }>()

const titleId = useId()
const panel = useTemplateRef('panel')
const closeButton = useTemplateRef('closeButton')
const {
  state,
  zIndex,
  visible: expanded,
  open: expand,
  close,
} = useModal({
  focusOnOpen: () => closeButton.value?.$el,
  focusOnClose: () => panel.value?.querySelector<HTMLElement>('[data-expand]'),
})
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <div
      :class="expanded && 'fixed inset-0 flex p-2 sm:p-4'"
      :style="expanded ? { zIndex } : undefined"
      :role="expanded ? 'dialog' : undefined"
      :aria-modal="expanded || undefined"
      :aria-labelledby="expanded ? titleId : undefined"
    >
      <div
        v-if="expanded"
        class="absolute inset-0 bg-[rgb(8_6_28/0.62)] backdrop-blur-sm"
        :class="state === 'closing' ? 'animate-backdrop-out' : 'animate-backdrop-in'"
        aria-hidden="true"
        @click="close"
      />
      <div
        ref="panel"
        :class="
          cn(
            'overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card',
            props.class,
            expanded && [
              'relative flex size-full flex-col rounded-2xl shadow-floating',
              state === 'closing' ? 'animate-modal-out' : 'animate-modal-in',
            ],
          )
        "
      >
        <div v-if="expanded" class="flex items-center justify-between gap-4 border-b px-5 py-3">
          <div class="min-w-0">
            <h2 :id="titleId" class="text-xl font-semibold tracking-tight">{{ title }}</h2>
            <p v-if="subtitle" class="truncate text-sm text-muted-foreground">{{ subtitle }}</p>
          </div>
          <Button ref="closeButton" variant="ghost" size="icon" aria-label="Fechar" title="Fechar (Esc)" @click="close">
            <PhX weight="bold" aria-hidden="true" />
          </Button>
        </div>
        <slot :expanded="expanded" :expand="expand" />
      </div>
    </div>
  </Teleport>
</template>
