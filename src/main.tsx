import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider'
import './index.css'
import { router } from './routes'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

// Dev only: after a hot reload, cached data may have an older shape than the new code expects
// (e.g. a query gained a field). Reset the cache so every query refetches with the new code.
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => queryClient.resetQueries())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
