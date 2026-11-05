import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    watch: { usePolling: process.cwd().startsWith('/mnt/') },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'core', include: ['src/test/{domain,application,infrastructure}/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'ui', include: ['src/test/presentation/**/*.test.ts'], environment: 'happy-dom' },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/test/**', 'src/main.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/domain/**': { lines: 95, functions: 95, branches: 75 },
        'src/application/**': { lines: 90, functions: 85, branches: 70 },
        'src/infrastructure/**': { lines: 90, functions: 80, branches: 45 },
        'src/presentation/composables/**': { lines: 85, functions: 75, branches: 50 },
        'src/presentation/components/**': { lines: 60, functions: 50, branches: 45 },
        'src/presentation/pages/**': { lines: 85, functions: 75, branches: 60 },
      },
    },
  },
})
