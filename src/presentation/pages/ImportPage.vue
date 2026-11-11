<script setup lang="ts">
import { PhArrowRight } from '@phosphor-icons/vue'
import { computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import type { CompanyId } from '@/domain/dre'
import FileDropzone from '@/presentation/components/FileDropzone.vue'
import PageBand from '@/presentation/components/PageBand.vue'
import { Button } from '@/presentation/components/ui/button'
import { useReport } from '@/presentation/composables/useReport'
import { formatPeriod } from '@/presentation/format'

const router = useRouter()
const { companies, isImporting, error, importFiles, selectCompany, clearError } = useReport()
onBeforeUnmount(clearError)

/**
 * Planilhas importadas sem erro abrem direto na DRE (da primeira delas; o seletor do cabeçalho troca de operação).
 * Com algum erro, fica aqui para mostrar o que houve, com as planilhas que abriram listadas abaixo.
 */
async function onSelect(files: File[]) {
  const imported = await importFiles(files)
  if (imported.length && !error.value) await router.push({ name: 'dre' })
}

/** As planilhas já abertas, uma por operação, para voltar à DRE de qualquer uma. */
const opened = computed(() =>
  companies.value.flatMap(({ id, company, report }) =>
    report.periods.length
      ? [{ id, company, name: report.name, periods: `${formatPeriod(report.periods[0]!)} a ${formatPeriod(report.periods.at(-1)!)}` }]
      : [],
  ),
)

function open(id: CompanyId) {
  selectCompany(id)
  router.push({ name: 'dre' })
}
</script>

<template>
  <PageBand>
    <div class="max-w-3xl pt-8">
      <h1 class="text-[2.45rem] leading-tight">Importe o fechamento financeiro</h1>
      <p class="mt-3 max-w-[60ch] text-lg leading-relaxed text-band-muted">
        Arraste a planilha de fechamento da Boatlux, a da RS Náutica ou as duas juntas. A operação é reconhecida pela planilha, que abre direto no resultado do último mês encerrado.
      </p>
    </div>

    <FileDropzone :disabled="isImporting" class="mt-8" @select="onSelect" />

    <Transition name="fade">
      <p
        v-if="error"
        role="alert"
        class="mt-4 rounded-sm border-l-4 border-l-band-loss bg-white/5 px-4 py-3 text-sm whitespace-pre-line text-band-foreground"
      >
        {{ error }}
      </p>
    </Transition>

    <ul v-if="opened.length" class="mt-6 divide-y divide-band-border border-t border-band-border">
      <li v-for="item in opened" :key="item.id" class="flex flex-wrap items-center justify-between gap-4 py-5">
        <p class="min-w-0 text-band-muted">
          <span class="text-band-foreground">{{ item.company }}</span>: {{ item.name }}, {{ item.periods }}
        </p>
        <Button @click="open(item.id)">
          {{ opened.length > 1 ? `Abrir a DRE da ${item.company}` : 'Voltar para a DRE' }}
          <PhArrowRight aria-hidden="true" />
        </Button>
      </li>
    </ul>
  </PageBand>
</template>
