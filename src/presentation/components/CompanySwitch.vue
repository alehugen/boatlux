<script setup lang="ts">
import type { CompanyId } from '@/domain/dre'
import { useRouter } from 'vue-router'
import { useReport } from '@/presentation/composables/useReport'

/**
 * Alterna entre as operações com planilha aberta (Boatlux e RS Náutica). Só aparece com as duas abertas.
 * Fora da DRE (na importação, por exemplo), escolher uma operação abre a DRE dela.
 */
const { companies, activeId, selectCompany } = useReport()
const router = useRouter()

function choose(id: CompanyId) {
  selectCompany(id)
  if (router.currentRoute.value.name !== 'dre') void router.push({ name: 'dre' })
}
</script>

<template>
  <div
    v-if="companies.length > 1"
    role="group"
    aria-label="Operação"
    class="flex items-center gap-0.5 rounded-lg border border-band-border p-0.5 text-sm"
  >
    <button
      v-for="item in companies"
      :key="item.id"
      type="button"
      :aria-pressed="item.id === activeId"
      class="rounded-md px-3 py-1.5 whitespace-nowrap transition-colors duration-(--duration-fast) ease-out focus-visible:outline-2 focus-visible:outline-water"
      :class="item.id === activeId ? 'bg-water text-water-foreground' : 'text-band-muted hover:bg-white/5 hover:text-band-foreground'"
      @click="choose(item.id)"
    >
      {{ item.company }}
    </button>
  </div>
</template>
