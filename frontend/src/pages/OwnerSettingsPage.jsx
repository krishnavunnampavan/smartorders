import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, CheckCircle, XCircle, Circle, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

function StatusIcon({ status }) {
  if (status === 'connected') return <CheckCircle size={16} className="text-green-400" />
  if (status === 'invalid')   return <XCircle size={16} className="text-red-400" />
  return <Circle size={16} className="text-gray-500" />
}

function KeyInput({ label, value, onChange, onTest, testing, status }) {
  const [show, setShow] = useState(false)
  return (
    <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#e6edf3] font-medium">{label}</h3>
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon status={status} />
          <span className={status === 'connected' ? 'text-green-400' : status === 'invalid' ? 'text-red-400' : 'text-[#8b949e]'}>
            {status === 'connected' ? 'Connected' : status === 'invalid' ? 'Invalid' : 'Not set'}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            className="w-full bg-[#0d1117] border border-[rgba(48,54,61,0.8)] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]/60 pr-10"
            placeholder={`Enter ${label}…`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]" onClick={() => setShow(!show)}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          className="px-3 py-2 rounded-lg text-sm bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.8)] transition-colors disabled:opacity-40"
          onClick={() => onTest(value)}
          disabled={!value || testing}
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
      </div>
    </div>
  )
}

export default function OwnerSettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [preferred, setPreferred] = useState('auto')
  const [testing, setTesting] = useState({})
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: aiStatus, refetch } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => client.get('/settings/ai-status').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) => client.post('/settings/api-keys', body),
    onSuccess: () => { toast.success('API keys saved'); refetch() },
    onError: () => toast.error('Failed to save keys'),
  })

  const testKey = async (provider, key) => {
    if (!key) return
    setTesting((t) => ({ ...t, [provider]: true }))
    try {
      const { data } = await client.post('/settings/test-ai-key', { provider, key })
      toast[data.status === 'connected' ? 'success' : 'error'](`${provider}: ${data.status}`)
    } finally {
      setTesting((t) => ({ ...t, [provider]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="bg-[#161b22] border-b border-[rgba(48,54,61,0.8)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🍾</span>
          <span className="text-[#e6edf3] font-bold">LiquorStore Pro</span>
          <span className="text-[#58a6ff] text-xs font-medium">Owner — Settings</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-red-400 transition-colors">
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/owner" className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <h1 className="text-xl font-bold text-[#e6edf3] mb-2">Platform Settings</h1>
        <p className="text-[#8b949e] text-sm mb-8">Manage AI API keys and platform-wide configuration</p>

        <h2 className="text-[#e6edf3] font-semibold text-sm mb-4">AI API Keys</h2>
        <p className="text-[#8b949e] text-sm mb-5">
          These keys power voice ordering, photo parsing, and smart order suggestions across all stores.
        </p>

        <KeyInput label="OpenAI API Key" value={openaiKey} onChange={setOpenaiKey} onTest={(k) => testKey('openai', k)} testing={testing.openai} status={aiStatus?.openai || 'not_set'} />
        <KeyInput label="Claude (Anthropic) API Key" value={claudeKey} onChange={setClaudeKey} onTest={(k) => testKey('claude', k)} testing={testing.claude} status={aiStatus?.claude || 'not_set'} />

        <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-5 mb-6">
          <h3 className="text-[#e6edf3] font-medium mb-3">Preferred Provider</h3>
          <div className="space-y-2">
            {['auto', 'openai', 'claude'].map((p) => (
              <label key={p} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="preferred" value={p} checked={preferred === p} onChange={() => setPreferred(p)} className="accent-[#58a6ff]" />
                <span className="text-[#e6edf3] text-sm capitalize">
                  {p === 'auto' ? 'Auto (use whichever is available)' : p}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => saveMutation.mutate({ openai_key: openaiKey || undefined, claude_key: claudeKey || undefined, preferred_provider: preferred })}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors font-medium disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save API Keys'}
        </button>
      </div>
    </div>
  )
}
