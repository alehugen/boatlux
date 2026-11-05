import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

export const ThemePreference = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const

export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference]

const STORAGE_KEY = 'boatlux:theme'
const DEFAULT_THEME: ThemePreference = ThemePreference.Dark

const isThemePreference = (value: unknown): value is ThemePreference =>
  Object.values(ThemePreference).includes(value as ThemePreference)

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemePreference(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readStoredPreference())

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const systemPrefersDark = ref(mediaQuery.matches)
  mediaQuery.addEventListener('change', (event) => {
    systemPrefersDark.value = event.matches
  })

  const isDark = computed(() =>
    preference.value === ThemePreference.System
      ? systemPrefersDark.value
      : preference.value === ThemePreference.Dark,
  )

  watchEffect(() => document.documentElement.classList.toggle('dark', isDark.value))

  watchEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference.value)
    } catch {
    }
  })

  return { preference, isDark }
})

export function useTheme() {
  return storeToRefs(useThemeStore())
}
