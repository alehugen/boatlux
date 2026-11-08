<script setup lang="ts">
import { PhArrowRight } from '@phosphor-icons/vue'
import { computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import PageBand from '@/presentation/components/PageBand.vue'
import { Button } from '@/presentation/components/ui/button'
import { useReport } from '@/presentation/composables/useReport'
import { formatPeriod } from '@/presentation/format'

const router = useRouter()
const { report, isImporting, error, importFile, clearError } = useReport()
onBeforeUnmount(clearError)

/** A planilha importada sem erro abre direto na DRE. */
async function onSelect(file: File) {
  if (await importFile(file)) await router.push({ name: 'dre' })
}

const opened = computed(() => {
  const current = report.value
  if (!current?.periods.length) return null
  return { name: current.name, periods: `${formatPeriod(current.periods[0]!)} a ${formatPeriod(current.periods.at(-1)!)}` }
})
</script>

<template>
  <PageBand>
    <div class="max-w-3xl pt-8">
      <h1 class="text-[2.45rem] leading-tight">Importe o fechamento financeiro</h1>
      <p class="mt-3 max-w-[60ch] text-lg leading-relaxed text-band-muted">
        Arraste a planilha de fechamento da Boatlux. Ela abre direto no resultado do último mês encerrado.
      </p>
    </div>

    <FileDropzone :disabled="isImporting" class="mt-8" @select="onSelect" />

    <Transition name="fade">
      <p
        v-if="error"
        role="alert"
        class="mt-4 rounded-sm border-l-4 border-l-band-loss bg-white/5 px-4 py-3 text-sm text-band-foreground"
      >
        {{ error }}
      </p>
    </Transition>

    <div v-if="opened" class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-band-border pt-6">
      <p class="min-w-0 text-band-muted">
        Planilha aberta: <span class="text-band-foreground">{{ opened.name }}</span>, {{ opened.periods }}
      </p>
      <Button as-child>
        <RouterLink :to="{ name: 'dre' }">
          Voltar para a DRE
          <PhArrowRight aria-hidden="true" />
        </RouterLink>
      </Button>
    </div>
  </PageBand>
</template>
