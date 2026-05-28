import axios from 'axios'
import toast from 'react-hot-toast'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Attach X-Store-Key on every request from persisted auth state
client.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('liquorstore-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      if (state?.storeKey) {
        config.headers['X-Store-Key'] = state.storeKey
      }
    }
  } catch {
    // ignore parse errors
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'An error occurred'
    // Don't toast 401 — the auth guard handles that
    if (err.response?.status !== 401) {
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

export default client
