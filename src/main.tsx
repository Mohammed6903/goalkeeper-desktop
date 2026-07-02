import './theme/catppuccin.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { queryClient } from './lib/queryClient'
import App from './App'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="bottom-right" theme="dark" />
    </QueryClientProvider>
  </StrictMode>,
)
