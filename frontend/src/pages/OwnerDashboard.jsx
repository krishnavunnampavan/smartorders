import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Store, Plus, LogOut, Settings, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { formatCurrency } from '../utils/formatters'

function StatCard({ label, value, sub, color = 'text-[#e6edf3]' }) {
  return (
    <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-5">
      <p className="text-[#8b949e] text-xs uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[#8b949e] text-xs mt-1">{sub}</p>}
    </div>
  )
}

function StoreCard({ store, onOpen }) {
  const { data: stats } = useQuery({
    queryKey: ['store-stats', store.id],
    queryFn: () => client.get(`/stores/${store.id}/stats`).then((r) => r.data),
    staleTime: 60_000,
  })

  return (
    <div className={`bg-[#161b22] border rounded-xl p-5 transition-colors ${
      store.is_active
        ? 'border-[rgba(48,54,61,0.8)] hover:border-[rgba(88,166,255,0.2)]'
        : 'border-red-900/30 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            store.is_active ? 'bg-[#58a6ff]/10' : 'bg-red-900/20'
          }`}>
            <Store size={18} className={store.is_active ? 'text-[#58a6ff]' : 'text-red-400'} />
          </div>
          <div>
            <p className="text-[#e6edf3] font-semibold text-sm">{store.name}</p>
            <p className="text-[#8b949e] text-xs mt-0.5">Key: {store.access_key}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
          store.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
        }`}>
          {store.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="text-center">
          <p className="text-[#e6edf3] font-bold text-lg">{stats?.order_count ?? '—'}</p>
          <p className="text-[#8b949e] text-[10px]">Orders</p>
        </div>
        <div className="text-center">
          <p className="text-[#e6edf3] font-bold text-lg">{stats?.inventory_items ?? '—'}</p>
          <p className="text-[#8b949e] text-[10px]">Inventory</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#8b949e] truncate">
            {stats?.last_inventory_upload
              ? new Date(stats.last_inventory_upload).toLocaleDateString()
              : 'No upload'}
          </p>
          <p className="text-[#8b949e] text-[10px]">Last upload</p>
        </div>
      </div>

      {store.address && (
        <p className="text-[#8b949e] text-xs mt-3 truncate">{store.address}</p>
      )}

      <div className="flex gap-2 mt-4">
        <Link
          to={`/owner/stores/${store.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-[#58a6ff]/10 text-[#58a6ff] hover:bg-[#58a6ff]/20 transition-colors"
        >
          Manage <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}

export default function OwnerDashboard() {
  const { storeName, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: stores, isLoading } = useQuery({
    queryKey: ['owner-stores'],
    queryFn: () => client.get('/stores').then((r) => r.data),
  })

  const activeStores = stores?.filter((s) => s.is_active) ?? []
  const totalStores  = stores?.length ?? 0

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top bar */}
      <div className="bg-[#161b22] border-b border-[rgba(48,54,61,0.8)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍾</span>
          <div>
            <h1 className="text-[#e6edf3] font-bold text-lg tracking-tight">LiquorStore Pro</h1>
            <p className="text-[#58a6ff] text-xs font-medium">Platform Owner Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#8b949e] text-sm hidden sm:block">{storeName}</span>
          <Link
            to="/owner/settings"
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors"
          >
            <Settings size={15} /> Settings
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-[#8b949e] hover:text-red-400 hover:bg-red-900/10 transition-colors"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-[#e6edf3]">All Liquor Stores</h2>
            <p className="text-[#8b949e] text-sm mt-0.5">Manage all stores under your platform</p>
          </div>
          <Link
            to="/owner/stores/new"
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25 transition-colors font-medium"
          >
            <Plus size={15} /> Add New Store
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Stores" value={totalStores} />
          <StatCard label="Active Stores" value={activeStores.length} color="text-green-400" />
          <StatCard label="Inactive" value={totalStores - activeStores.length} color="text-red-400" />
          <StatCard
            label="Platform"
            value="Owner"
            sub="Full access"
            color="text-[#58a6ff]"
          />
        </div>

        {/* Stores grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : stores?.length === 0 ? (
          <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-xl p-12 text-center">
            <Store size={40} className="text-[#8b949e] mx-auto mb-4 opacity-50" />
            <p className="text-[#8b949e] text-sm">No stores yet.</p>
            <Link
              to="/owner/stores/new"
              className="inline-flex items-center gap-2 mt-4 text-sm px-4 py-2 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
            >
              <Plus size={14} /> Create First Store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
