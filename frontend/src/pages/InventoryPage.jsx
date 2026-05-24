import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShoppingCart, Zap, List, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import client from '../api/client'
import { useOrderStore } from '../store/orderStore'

// ── Quick Count Mode: large tap targets, immediate API calls ─────────────
function QuickCountRow({ product }) {
  const qc = useQueryClient()
  const [localStock, setLocalStock] = useState(product.current_stock)
  const [saving, setSaving] = useState(false)
  const isLow = localStock < product.reorder_level

  const commit = async (newStock) => {
    setSaving(true)
    try {
      await client.post(`/products/${product.id}/stock`, {
        new_stock: newStock,
        change_reason: 'quick_count',
      })
      qc.invalidateQueries(['inventory-alerts'])
    } catch {
      // revert on error
      setLocalStock(product.current_stock)
      toast.error('Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  const change = (delta) => {
    const next = Math.max(0, localStock + delta)
    setLocalStock(next)
    commit(next)
  }

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
      isLow ? 'border-red-800/50 bg-red-900/8' : 'border-[rgba(48,54,61,0.6)] bg-[rgba(22,27,34,0.4)]'
    }`}>
      <div className="flex-1 min-w-0">
        <p className="text-[#e6edf3] font-medium text-sm truncate">{product.name}</p>
        <p className="text-[#8b949e] text-xs">{product.category || '—'} · reorder ≤ {product.reorder_level}</p>
      </div>

      {saving && <Loader size={14} className="text-[#8b949e] animate-spin shrink-0" />}

      {/* Large tap targets */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => change(-1)}
          disabled={saving || localStock === 0}
          className="w-10 h-10 rounded-xl bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-xl font-bold flex items-center justify-center hover:bg-red-900/30 hover:text-red-300 disabled:opacity-30 transition-colors active:scale-95"
        >−</button>
        <span className={`w-12 text-center font-mono font-bold text-lg ${isLow ? 'text-red-400' : 'text-green-400'}`}>
          {localStock}
        </span>
        <button
          onClick={() => change(1)}
          disabled={saving}
          className="w-10 h-10 rounded-xl bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-xl font-bold flex items-center justify-center hover:bg-green-900/30 hover:text-green-300 disabled:opacity-30 transition-colors active:scale-95"
        >+</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const qc = useQueryClient()
  const [updateMap, setUpdateMap] = useState({})
  const [search, setSearch] = useState('')
  const [quickMode, setQuickMode] = useState(false)
  const { addResolvedItem } = useOrderStore()

  const addToOrder = (alert) => {
    addResolvedItem({
      product_id: alert.product_id,
      product_name: alert.name,
      company_id: alert.company_id || null,
      quantity: alert.reorder_level || 1,
      unit_price: 0,
      source: 'inventory',
    })
    toast.success(`${alert.name} added to cart`)
  }

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get('/products').then((r) => r.data),
  })
  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => client.get('/inventory/alerts').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, stock }) =>
      client.post(`/products/${id}/stock`, { new_stock: stock, change_reason: 'manual_update' }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['inventory-alerts'])
      setUpdateMap((m) => { const n = { ...m }; delete n[id]; return n })
      toast.success('Stock updated')
    },
  })

  const filtered = (products || []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Inventory">
      {/* Low stock alerts */}
      {alerts?.length > 0 && (
        <div className="glass-card p-4 mb-4 border border-red-800/50 bg-red-900/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-red-400 font-semibold text-sm">Low Stock ({alerts.length}) — needs ordering</h2>
          </div>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.product_id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-red-300 flex-1 truncate">
                  {a.name}
                  <span className="text-red-400/60 ml-1">({a.current_stock}/{a.reorder_level})</span>
                </span>
                <button
                  onClick={() => addToOrder(a)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors shrink-0"
                >
                  <ShoppingCart size={11} /> Add to Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3">
        <input
          className="input-field flex-1"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {/* Quick Count toggle */}
        <button
          onClick={() => setQuickMode((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            quickMode
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'btn-secondary'
          }`}
        >
          {quickMode ? <List size={15} /> : <Zap size={15} />}
          {quickMode ? 'Normal Mode' : 'Quick Count'}
        </button>
      </div>

      {/* Quick Count mode banner */}
      {quickMode && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs flex items-center gap-1.5">
          <Zap size={12} />
          Quick Count Mode — tap +/− to instantly update stock. Walk the floor and count as you go.
        </div>
      )}

      {/* Quick Count Mode layout */}
      {quickMode ? (
        <div className="space-y-2">
          {filtered.map((p) => (
            <QuickCountRow key={p.id} product={p} />
          ))}
          {!filtered.length && (
            <p className="text-center text-[#8b949e] py-12">No products found.</p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((p) => {
              const isLow = p.current_stock < p.reorder_level
              return (
                <div key={p.id} className={`glass-card p-4 ${isLow ? 'border border-red-800/50' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[#e6edf3] font-medium text-sm">{p.name}</p>
                      <p className="text-[#8b949e] text-xs">{p.category} · reorder at {p.reorder_level}</p>
                    </div>
                    <span className={`font-mono text-lg font-bold ${isLow ? 'text-red-400' : 'text-green-400'}`}>
                      {p.current_stock}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} className="input-field flex-1 py-1.5 text-sm"
                      placeholder={`New qty (current: ${p.current_stock})`}
                      value={updateMap[p.id] ?? ''}
                      onChange={(e) => setUpdateMap((m) => ({ ...m, [p.id]: parseInt(e.target.value) }))}
                    />
                    <button
                      className="btn-primary text-sm py-1.5 px-4 shrink-0"
                      onClick={() => updateMutation.mutate({ id: p.id, stock: updateMap[p.id] })}
                      disabled={updateMap[p.id] == null}
                    >Save</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(48,54,61,0.8)] text-[#8b949e] text-xs">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-3 py-3">Category</th>
                  <th className="text-center px-3 py-3">Current</th>
                  <th className="text-center px-3 py-3">Reorder At</th>
                  <th className="px-5 py-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isLow = p.current_stock < p.reorder_level
                  return (
                    <tr key={p.id} className={`border-b border-[rgba(48,54,61,0.3)] ${isLow ? 'bg-red-900/10' : ''}`}>
                      <td className="px-5 py-3 text-[#e6edf3] font-medium">{p.name}</td>
                      <td className="px-3 py-3 text-[#8b949e]">{p.category || '—'}</td>
                      <td className={`px-3 py-3 text-center font-mono ${isLow ? 'text-red-400 font-bold' : 'text-[#e6edf3]'}`}>
                        {p.current_stock}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[#8b949e]">{p.reorder_level}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={0} className="input-field w-20 py-1 text-sm"
                            placeholder={String(p.current_stock)}
                            value={updateMap[p.id] ?? ''}
                            onChange={(e) => setUpdateMap((m) => ({ ...m, [p.id]: parseInt(e.target.value) }))}
                          />
                          <button
                            className="btn-primary text-xs py-1.5 px-3"
                            onClick={() => updateMutation.mutate({ id: p.id, stock: updateMap[p.id] })}
                            disabled={updateMap[p.id] == null}
                          >Save</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  )
}
