import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const core = fileURLToPath(new URL('./core', import.meta.url))
const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  main: {
    resolve: { alias: { '@core': core } },
    build: { rollupOptions: { input: 'electron/main.ts' } },
  },
  preload: {
    resolve: { alias: { '@core': core } },
    build: { rollupOptions: { input: 'electron/preload.ts' } },
  },
  renderer: {
    root: 'src',
    resolve: { alias: { '@core': core, '@': src } },
    plugins: [react(), tailwind()],
    build: { rollupOptions: { input: 'src/index.html' } },
  },
})
