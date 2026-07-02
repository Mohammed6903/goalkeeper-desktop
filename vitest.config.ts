import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], globals: true },
  resolve: {
    alias: {
      '@core': new URL('./core', import.meta.url).pathname,
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
