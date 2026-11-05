<script setup lang="ts">
import { PhUploadSimple } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { SUPPORTED_EXTENSIONS } from '@/domain/ingestion'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ select: [files: File[]] }>()

const dragDepth = ref(0)
const isDragging = computed(() => dragDepth.value > 0)
const accept = SUPPORTED_EXTENSIONS.join(',')

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const files = event.dataTransfer?.files
  if (files?.length) emit('select', [...files])
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) emit('select', [...input.files])
  input.value = ''
}
</script>

<template>
  <label
    class="flex cursor-pointer flex-col items-start gap-4 rounded-xl border-2 border-dashed p-8 transition-colors duration-(--duration-base) ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:flex-row sm:items-center"
    :class="[
      isDragging ? 'border-primary bg-accent' : 'border-strong bg-card hover:border-muted-foreground',
      disabled && 'pointer-events-none animate-pulse opacity-70',
    ]"
    @dragenter.prevent="dragDepth++"
    @dragover.prevent
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @drop.prevent="onDrop"
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-(--duration-slow) ease-spring"
      :class="isDragging ? 'scale-110 bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
    >
      <PhUploadSimple :size="24" weight="bold" aria-hidden="true" />
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-xl font-semibold text-foreground">
        {{ disabled ? 'Importando arquivos…' : isDragging ? 'Solte para importar' : 'Arraste os arquivos aqui ou clique para escolher' }}
      </span>
      <span class="text-sm text-muted-foreground">
        Aceita {{ SUPPORTED_EXTENSIONS.join(', ') }}. Pode enviar vários de uma vez.
      </span>
    </span>
    <input type="file" class="sr-only" multiple :accept="accept" :disabled="disabled" @change="onChange" />
  </label>
</template>
