import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const InstallPrompt = lazy(() => import('./components/shared/InstallPrompt'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161b22',
            color: '#e6edf3',
            border: '1px solid rgba(48,54,61,0.8)',
          },
        }}
      />
      {/* PWA install prompt + update notification */}
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
)
