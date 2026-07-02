import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const core = fileURLToPath(new URL('./core', import.meta.url))
const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@core': core } },
    build: { rollupOptions: { input: './electron/main.ts' } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@core': core } },
    build: {
      rollupOptions: {
        input: './electron/preload.ts',
        // Emit .cjs (not .js) so the CommonJS preload isn't misparsed as ESM
        // under package.json "type":"module" — otherwise it fails to load in
        // the packaged app and window.gk is never exposed.
        output: { format: 'cjs', entryFileNames: 'preload.cjs' },
      },
    },
  },
  renderer: {
    root: 'src',
    resolve: { alias: { '@core': core, '@': src } },
    plugins: [react(), tailwind()],
    build: { rollupOptions: { input: 'src/index.html' } },
  },
})
