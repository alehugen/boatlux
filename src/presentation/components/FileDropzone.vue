<script setup lang="ts">
import { PhUploadSimple } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { MAX_FILE_SIZE_MB, SUPPORTED_EXTENSIONS } from '@/domain/ingestion'

defineProps<{ disabled?: boolean }>()
/** Aceita várias planilhas de uma vez (ex.: a da Boatlux e a da RS Náutica). */
const emit = defineEmits<{ select: [files: File[]] }>()

const dragDepth = ref(0)
const isDragging = computed(() => dragDepth.value > 0)
const accept = SUPPORTED_EXTENSIONS.join(',')
const extensions = SUPPORTED_EXTENSIONS.join(' ou ')

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) emit('select', files)
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (files.length) emit('select', files)
  input.value = ''
}
</script>

<template>
  <label
    class="flex cursor-pointer flex-col items-start gap-5 rounded-sm border-2 border-dashed px-8 py-10 transition-colors duration-(--duration-base) ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-water sm:flex-row sm:items-center sm:gap-7"
    :class="[
      isDragging ? 'border-water bg-water/10' : 'border-band-border bg-white/3 hover:border-band-muted',
      disabled && 'pointer-events-none animate-pulse opacity-70',
    ]"
    @dragenter.prevent="dragDepth++"
    @dragover.prevent
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @drop.prevent="onDrop"
  >
    <span
      class="flex size-16 shrink-0 items-center justify-center rounded-sm bg-water text-water-foreground transition-transform duration-(--duration-slow) ease-spring"
      :class="isDragging && 'scale-110'"
    >
      <PhUploadSimple :size="28" weight="bold" aria-hidden="true" />
    </span>
    <span class="flex flex-col gap-1.5">
      <span class="text-[1.375rem] text-band-foreground">
        {{ disabled ? 'Importando…' : isDragging ? 'Solte para importar' : 'Arraste as planilhas aqui ou clique para escolher' }}
      </span>
      <span class="text-[0.95rem] text-band-muted">
        Uma ou mais, em {{ extensions }}, até {{ MAX_FILE_SIZE_MB }} MB cada. As planilhas não saem do seu computador.
      </span>
    </span>
    <input type="file" multiple class="sr-only" :accept="accept" :disabled="disabled" @change="onChange" />
  </label>
</template>
