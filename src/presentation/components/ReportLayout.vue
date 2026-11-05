<script setup lang="ts">
import SectionNav, { type NavSection } from './SectionNav.vue'

defineProps<{ sections: readonly NavSection[] }>()
</script>

<template>
  <div class="grid gap-x-10 gap-y-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
    <SectionNav :sections="sections">
      <template v-if="$slots.controls" #controls>
        <slot name="controls" />
      </template>
    </SectionNav>
    <div class="min-w-0 space-y-10">
      <slot />
    </div>
  </div>
</template>
