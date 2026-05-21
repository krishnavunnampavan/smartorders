import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, CheckCircle, XCircle, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import client from '../api/client'

const TABS = ['API Keys', 'Store Info', 'Order Rules']

function StatusIcon({ status }) {
  if (status === 'connected') return <CheckCircle size={16} className="text-green-400" />
  if (status === 'invalid') return <XCircle size={16} className="text-red-400" />
  return <Circle size={16} className="text-gray-500" />
}

function KeyInput({ label, value, onChange, provider, onTest, testing, status }) {
  const [show, setShow] = useState(false)
  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#e6edf3] font-medium">{label}</h3>
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon status={status} />
          <span className={
            status === 'connected' ? 'text-green-400' :
            status === 'invalid' ? 'text-red-400' : 'text-[#8b949e]'
          }>
            {status === 'connected' ? 'Connected' : status === 'invalid' ? 'Invalid' : 'Not set'}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            className="input-field pr-10"
            placeholder={`Enter ${label}…`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          className="btn-secondary px-3 text-sm"
          onClick={() => onTest(value)}
          disabled={!value || testing}
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
      </div>
    </div>
  )
}

function APIKeysTab() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [preferred, setPreferred] = useState('auto')
  const [testing, setTesting] = useState({})

  const { data: aiStatus, refetch } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => client.get('/settings/ai-status').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) => client.post('/settings/api-keys', body),
    onSuccess: () => { toast.success('API keys saved'); refetch() },
  })

  const testKey = async (provider, key) => {
    if (!key) return
    setTesting((t) => ({ ...t, [provider]: true }))
    try {
      const { data } = await client.post('/settings/test-ai-key', { provider, key })
      toast[data.status === 'connected' ? 'success' : 'error'](
        `${provider}: ${data.status}`
      )
    } finally {
      setTesting((t) => ({ ...t, [provider]: false }))
    }
  }

  return (
    <div className="max-w-xl">
      <p className="text-[#8b949e] text-sm mb-6">
        Add your AI API keys below. If your preferred provider fails, the app automatically tries the other one.
      </p>

      <KeyInput
        label="OpenAI API Key"
        value={openaiKey}
        onChange={setOpenaiKey}
        provider="openai"
        onTest={(k) => testKey('openai', k)}
        testing={testing.openai}
        status={aiStatus?.openai || 'not_set'}
      />

      <KeyInput
        label="Claude (Anthropic) API Key"
        value={claudeKey}
        onChange={setClaudeKey}
        provider="claude"
        onTest={(k) => testKey('claude', k)}
        testing={testing.claude}
        status={aiStatus?.claude || 'not_set'}
      />

      <div className="glass-card p-5 mb-6">
        <h3 className="text-[#e6edf3] font-medium mb-3">Preferred Provider</h3>
        <div className="space-y-2">
          {['auto', 'openai', 'claude'].map((p) => (
            <label key={p} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="preferred"
                value={p}
                checked={preferred === p}
                onChange={() => setPreferred(p)}
                className="accent-[#58a6ff]"
              />
              <span className="text-[#e6edf3] text-sm capitalize">
                {p === 'auto' ? 'Auto (use whichever is available)' : p}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={() => saveMutation.mutate({
          openai_key: openaiKey || undefined,
          claude_key: claudeKey || undefined,
          preferred_provider: preferred,
        })}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save API Keys'}
      </button>
    </div>
  )
}

function StoreInfoTab() {
  const [form, setForm] = useState({ store_name: '', store_address: '', store_phone: '', store_email: '' })
  const { data } = useQuery({
    queryKey: ['store-info'],
    queryFn: () => client.get('/settings/store').then((r) => r.data),
    onSuccess: (d) => setForm(d),
  })

  const saveMutation = useMutation({
    mutationFn: (body) => client.post('/settings/store', body),
    onSuccess: () => toast.success('Store info saved'),
  })

  return (
    <div className="max-w-xl space-y-4">
      {Object.entries({
        store_name: 'Store Name',
        store_address: 'Address',
        store_phone: 'Phone',
        store_email: 'Email',
      }).map(([key, label]) => (
        <div key={key}>
          <label className="block text-[#8b949e] text-xs mb-1 uppercase tracking-wide">{label}</label>
          <input
            className="input-field"
            value={form[key] || ''}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </div>
      ))}
      <button
        className="btn-primary"
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
      >
        Save Store Info
      </button>
    </div>
  )
}

function OrderRulesTab() {
  const { data: rules } = useQuery({
    queryKey: ['order-rules'],
    queryFn: () => client.get('/settings/rules').then((r) => r.data),
  })

  return (
    <div className="max-w-xl">
      <p className="text-[#8b949e] text-sm mb-4">
        These rules control how the price intelligence engine classifies products.
      </p>
      <div className="space-y-3">
        {rules?.map((rule) => (
          <div key={rule.id} className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[#e6edf3] text-sm font-medium">{rule.rule_name}</p>
              <p className="text-[#8b949e] text-xs">{rule.rule_type}</p>
            </div>
            <span className="font-mono text-accent-blue text-sm">{rule.threshold_value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('API Keys')

  return (
    <Layout title="Settings">
      <div className="flex gap-1 mb-8 p-1 rounded-lg bg-[#161b22] inline-flex">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[#58a6ff]/20 text-[#58a6ff]'
                : 'text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'API Keys' && <APIKeysTab />}
      {tab === 'Store Info' && <StoreInfoTab />}
      {tab === 'Order Rules' && <OrderRulesTab />}
    </Layout>
  )
}
