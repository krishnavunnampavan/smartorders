import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Store, Pencil, Save, X, Trash2, CheckCircle,
  Package, ShoppingCart, ToggleLeft, ToggleRight, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { useAuthStore } from '../store/authStore'
import { useNavigate as useNav } from 'react-router-dom'

function EditableField({ label, value, onSave, type = 'text', placeholder = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  const handleSave = () => { onSave(draft); setEditing(false) }

  if (editing) {
    return (
      <div>
        <p className="text-[#8b949e] text-xs mb-1">{label}</p>
        <div className="flex gap-2">
          <input
            type={type}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-[#0d1117] border border-[#58a6ff]/40 rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
          />
          <button onClick={handleSave} className="p-2 rounded-lg text-green-400 hover:bg-green-900/20"><Save size={15} /></button>
          <button onClick={() => { setEditing(false); setDraft(value || '') }} className="p-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3]"><X size={15} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="cursor-pointer group" onClick={() => setEditing(true)}>
      <p className="text-[#8b949e] text-xs mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-[#e6edf3] text-sm">{value || <span className="text-[#8b949e] italic">Click to add…</span>}</p>
        <Pencil size={11} className="text-[#8b949e] opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
    </div>
  )
}

export default function OwnerStoreDetailPage() {
  const { storeId } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: store, isLoading } = useQuery({
    queryKey: ['owner-store', storeId],
    queryFn: () => client.get(`/stores`).then((r) => r.data.find((s) => s.id === storeId)),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => client.put(`/stores/${storeId}`, data),
    onSuccess: () => { qc.invalidateQueries(['owner-stores']); qc.invalidateQueries(['owner-store', storeId]); toast.success('Store updated') },
    onError: () => toast.error('Update failed'),
  })

  const toggleActive = () => {
    updateMutation.mutate({ is_active: !store?.is_active })
    toast.success(store?.is_active ? 'Store deactivated' : 'Store activated')
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )

  if (!store) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-[#8b949e]">
      Store not found.{' '}
      <Link to="/owner" className="text-[#58a6ff] underline ml-2">Back</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top bar */}
      <div className="bg-[#161b22] border-b border-[rgba(48,54,61,0.8)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🍾</span>
          <span className="text-[#e6edf3] font-bold">LiquorStore Pro</span>
          <span className="text-[#58a6ff] text-xs font-medium">Owner</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/owner" className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* Store header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#58a6ff]/10 flex items-center justify-center">
            <Store size={24} className="text-[#58a6ff]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e6edf3]">{store.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono bg-[rgba(48,54,61,0.6)] text-[#58a6ff] px-2 py-0.5 rounded">
                Key: {store.access_key}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${store.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                {store.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <button
            onClick={toggleActive}
            disabled={updateMutation.isPending}
            className={`ml-auto flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
              store.is_active
                ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                : 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
            }`}
          >
            {store.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {store.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>

        {/* Store details */}
        <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-6 space-y-5 mb-6">
          <h2 className="text-[#e6edf3] font-semibold text-sm mb-4">Store Details</h2>
          <EditableField
            label="Store Name"
            value={store.name}
            onSave={(v) => updateMutation.mutate({ name: v })}
            placeholder="Store name"
          />
          <EditableField
            label="Address"
            value={store.address}
            onSave={(v) => updateMutation.mutate({ address: v })}
            placeholder="123 Main St, City, State"
          />
          <EditableField
            label="Phone"
            value={store.phone}
            onSave={(v) => updateMutation.mutate({ phone: v })}
            placeholder="+1 (555) 000-0000"
            type="tel"
          />
          <EditableField
            label="Notes"
            value={store.notes}
            onSave={(v) => updateMutation.mutate({ notes: v })}
            placeholder="Internal notes about this store…"
          />
        </div>

        {/* Created at */}
        <p className="text-[#8b949e] text-xs text-center">
          Store created {new Date(store.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
