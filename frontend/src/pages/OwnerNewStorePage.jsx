import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Store, Key, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'

export default function OwnerNewStorePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', access_key: '', address: '', phone: '' })
  const [errors, setErrors] = useState({})

  const createMutation = useMutation({
    mutationFn: (data) => client.post('/stores', data),
    onSuccess: () => {
      qc.invalidateQueries(['owner-stores'])
      toast.success('Store created!')
      navigate('/owner')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create store'
      toast.error(msg)
    },
  })

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Store name is required'
    if (!/^\d{4}$/.test(form.access_key)) e.access_key = 'Must be exactly 4 digits'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    createMutation.mutate({
      name: form.name.trim(),
      access_key: form.access_key,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
    })
  }

  const field = (key, label, placeholder, type = 'text', hint = '') => (
    <div>
      <label className="block text-[#8b949e] text-xs mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((er) => ({ ...er, [key]: '' })) }}
        placeholder={placeholder}
        maxLength={key === 'access_key' ? 4 : undefined}
        className={`w-full bg-[#0d1117] border rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] focus:outline-none transition-colors ${
          errors[key] ? 'border-red-500/60 focus:border-red-500' : 'border-[rgba(48,54,61,0.8)] focus:border-[#58a6ff]/60'
        }`}
      />
      {errors[key] && <p className="text-red-400 text-xs mt-1">{errors[key]}</p>}
      {hint && <p className="text-[#8b949e] text-xs mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="bg-[#161b22] border-b border-[rgba(48,54,61,0.8)] px-6 py-4 flex items-center gap-3">
        <span className="text-xl">🍾</span>
        <span className="text-[#e6edf3] font-bold">LiquorStore Pro</span>
        <span className="text-[#58a6ff] text-xs font-medium">Owner</span>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <Link to="/owner" className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#3fb950]/10 flex items-center justify-center">
            <Plus size={20} className="text-[#3fb950]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e6edf3]">Add New Store</h1>
            <p className="text-[#8b949e] text-sm">Create a new liquor store with an access key</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-6 space-y-5">
          {field('name', 'Store Name *', "Monaco's Wine and Liquor")}
          {field('access_key', '4-Digit Access Key *', '1234', 'text', 'Must be a unique 4-digit number. This is the key the store uses to log in.')}
          {field('address', 'Address (optional)', '123 Main St, City, State')}
          {field('phone', 'Phone (optional)', '+1 (555) 000-0000', 'tel')}

          <div className="pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25 transition-colors font-medium disabled:opacity-50"
            >
              <Store size={16} />
              {createMutation.isPending ? 'Creating…' : 'Create Store'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-4 bg-[rgba(88,166,255,0.05)] border border-[#58a6ff]/15 rounded-xl">
          <div className="flex items-start gap-2">
            <Key size={14} className="text-[#58a6ff] shrink-0 mt-0.5" />
            <div>
              <p className="text-[#58a6ff] text-xs font-medium">About Access Keys</p>
              <p className="text-[#8b949e] text-xs mt-1">
                The store will use their 4-digit key to log in. Each key must be unique.
                The platform owner key is <span className="text-[#58a6ff] font-mono">9542</span>.
                Monaco's key is <span className="text-[#58a6ff] font-mono">2178</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
