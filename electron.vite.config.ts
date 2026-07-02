import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  main: { build: { rollupOptions: { input: 'electron/main.ts' } } },
  preload: { build: { rollupOptions: { input: 'electron/preload.ts' } } },
  renderer: {
    root: 'src',
    plugins: [react(), tailwind()],
    build: { rollupOptions: { input: 'src/index.html' } },
  },
})
