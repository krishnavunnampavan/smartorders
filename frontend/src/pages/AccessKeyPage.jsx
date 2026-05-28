import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Delete, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const DIGITS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
]

export default function AccessKeyPage() {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth }           = useAuthStore()
  const navigate              = useNavigate()

  const push = (d) => {
    if (d === 'del') {
      setPin((p) => p.slice(0, -1))
      setError('')
      return
    }
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) verify(next)
  }

  const verify = async (key) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post('/api/auth/verify', { access_key: key })
      setAuth({
        storeKey: data.access_key,
        storeId: data.store_id,
        storeName: data.store_name,
        isOwner: data.is_owner,
      })
      toast.success(`Welcome, ${data.store_name}!`)
      navigate(data.is_owner ? '/owner' : '/')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid access key'
      setError(msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="text-4xl mb-3">🍾</div>
        <h1 className="text-2xl font-bold text-[#e6edf3] tracking-tight">LiquorStore Pro</h1>
        <p className="text-[#8b949e] text-sm mt-1">Enter your 4-digit access key</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-xs">
        <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-2xl p-8 shadow-2xl">
          {/* Lock icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              error ? 'bg-red-900/30 border-2 border-red-500/50' : 'bg-[#58a6ff]/10 border-2 border-[#58a6ff]/20'
            }`}>
              <Lock size={22} className={error ? 'text-red-400' : 'text-[#58a6ff]'} />
            </div>
          </div>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length
                    ? error
                      ? 'bg-red-400 border-red-400'
                      : 'bg-[#58a6ff] border-[#58a6ff]'
                    : 'bg-transparent border-[rgba(48,54,61,0.8)]'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center mb-4">
              <div className="w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* PIN pad */}
          <div className="space-y-3">
            {DIGITS.map((row, ri) => (
              <div key={ri} className="flex gap-3 justify-center">
                {row.map((d, ci) => {
                  if (d === '') return <div key={ci} className="w-16 h-14" />
                  return (
                    <button
                      key={ci}
                      onClick={() => push(d)}
                      disabled={loading}
                      className={`w-16 h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                        d === 'del'
                          ? 'bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:bg-[rgba(48,54,61,0.8)] hover:text-[#e6edf3]'
                          : 'bg-[rgba(88,166,255,0.08)] text-[#e6edf3] border border-[rgba(48,54,61,0.6)] hover:bg-[rgba(88,166,255,0.18)] hover:border-[#58a6ff]/30'
                      }`}
                    >
                      {d === 'del' ? <Delete size={18} className="mx-auto" /> : d}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[#8b949e] text-xs mt-6">
          Contact your platform owner to get an access key
        </p>
      </div>
    </div>
  )
}
