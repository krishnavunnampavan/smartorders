import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ShoppingCart, Zap, List, Plus, Edit2, Trash2,
  Search, X, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import ConfirmModal from '../components/shared/ConfirmModal'
import ProductModal from '../components/shared/ProductModal'
import client from '../api/client'
import { useOrderStore } from '../store/orderStore'
import { formatCurrency } from '../utils/formatters'

// ── Quick Count Row ───────────────────────────────────────────────────────
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
      {saving && <div className="w-4 h-4 border-2 border-[#8b949e] border-t-transparent rounded-full animate-spin shrink-0" />}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => change(-1)} disabled={saving || localStock === 0}
          className="w-10 h-10 rounded-xl bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-xl font-bold flex items-center justify-center hover:bg-red-900/30 hover:text-red-300 disabled:opacity-30 transition-colors active:scale-95">−</button>
        <span className={`w-12 text-center font-mono font-bold text-lg ${isLow ? 'text-red-400' : 'text-green-400'}`}>
          {localStock}
        </span>
        <button onClick={() => change(1)} disabled={saving}
          className="w-10 h-10 rounded-xl bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-xl font-bold flex items-center justify-center hover:bg-green-900/30 hover:text-green-300 disabled:opacity-30 transition-colors active:scale-95">+</button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [quickMode, setQuickMode] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const { addResolvedItem } = useOrderStore()

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get('/products?per_page=200').then((r) => r.data),
  })

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => client.get('/inventory/alerts').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editProduct?.id ? client.put(`/products/${editProduct.id}`, body) : client.post('/products', body),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['inventory-alerts'])
      setShowModal(false)
      setEditProduct(null)
      toast.success(editProduct?.id ? 'Product updated' : 'Product created')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['inventory-alerts'])
      setDeleteId(null)
      toast.success('Product removed')
    },
  })

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

  const openAdd = () => { setEditProduct(null); setShowModal(true) }
  const openEdit = (p) => { setEditProduct(p); setShowModal(true) }

  const filtered = (products || []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
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
                <button onClick={() => addToOrder(a)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors shrink-0">
                  <ShoppingCart size={11} /> Add to Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input className="input-field pl-9 pr-8" placeholder="Search products, brand, category…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
              onClick={() => setSearch('')}><X size={14} /></button>
          )}
        </div>
        <button onClick={() => setQuickMode((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            quickMode ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'btn-secondary'
          }`}>
          {quickMode ? <List size={15} /> : <Zap size={15} />}
          {quickMode ? 'List Mode' : 'Quick Count'}
        </button>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={15} /> Add Product
        </button>
      </div>

      {/* Quick Count mode banner */}
      {quickMode && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs flex items-center gap-1.5">
          <Zap size={12} />
          Quick Count Mode — tap +/− to instantly update stock. Walk the floor and count as you go.
        </div>
      )}

      {/* Quick Count Mode */}
      {quickMode ? (
        <div className="space-y-2">
          {filtered.map((p) => <QuickCountRow key={p.id} product={p} />)}
          {!filtered.length && <p className="text-center text-[#8b949e] py-12">No products found.</p>}
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !filtered.length ? (
        <div className="glass-card p-12 flex flex-col items-center gap-3">
          <Package size={36} className="text-[#8b949e]" />
          <p className="text-[#8b949e] text-sm">
            {search ? `No products matching "${search}"` : 'No products yet'}
          </p>
          {!search && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 mt-2">
              <Plus size={15} /> Add First Product
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((p) => {
              const isLow = p.current_stock < p.reorder_level
              const co = companies?.find((c) => c.id === p.company_id)
              return (
                <div key={p.id} className={`glass-card p-4 ${isLow ? 'border border-red-800/50' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-[#e6edf3] font-medium text-sm truncate">{p.name}</p>
                      <p className="text-[#8b949e] text-xs">{p.brand ? `${p.brand} · ` : ''}{p.category || '—'}</p>
                      {co && <p className="text-[#58a6ff] text-xs mt-0.5">{co.name}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg text-[#8b949e] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className={`font-mono font-bold ${isLow ? 'text-red-400' : 'text-green-400'}`}>
                      Stock: {p.current_stock}
                    </span>
                    <span className="text-[#8b949e]">Reorder: {p.reorder_level}</span>
                    {p.unit_price > 0 && (
                      <span className="text-green-400 font-mono">{formatCurrency(p.unit_price)}</span>
                    )}
                    {isLow && (
                      <button onClick={() => addToOrder({ product_id: p.id, name: p.name, company_id: p.company_id, reorder_level: p.reorder_level })}
                        className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors">
                        <ShoppingCart size={10} /> Order
                      </button>
                    )}
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
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-3 py-3">Brand</th>
                  <th className="text-left px-3 py-3">Category</th>
                  <th className="text-left px-3 py-3">Distributor</th>
                  <th className="text-center px-3 py-3">Stock</th>
                  <th className="text-center px-3 py-3">Reorder</th>
                  <th className="text-right px-3 py-3">Buy Cost</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isLow = p.current_stock < p.reorder_level
                  const co = companies?.find((c) => c.id === p.company_id)
                  return (
                    <tr key={p.id} className={`border-b border-[rgba(48,54,61,0.3)] hover:bg-[rgba(48,54,61,0.15)] transition-colors ${isLow ? 'bg-red-900/8' : ''}`}>
                      <td className="px-4 py-3 text-[#e6edf3] font-medium max-w-xs">
                        <p className="truncate">{p.name}</p>
                      </td>
                      <td className="px-3 py-3 text-[#8b949e] text-xs">{p.brand || '—'}</td>
                      <td className="px-3 py-3 text-[#8b949e] text-xs">{p.category || '—'}</td>
                      <td className="px-3 py-3 text-xs">
                        {co
                          ? <span className="text-[#58a6ff]">{co.name}</span>
                          : <span className="text-[#8b949e]">—</span>
                        }
                      </td>
                      <td className={`px-3 py-3 text-center font-mono font-bold ${isLow ? 'text-red-400' : 'text-[#e6edf3]'}`}>
                        {p.current_stock}
                        {isLow && <span className="text-red-400 text-[10px] ml-1">LOW</span>}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[#8b949e]">{p.reorder_level}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-green-400">
                        {p.unit_price ? formatCurrency(p.unit_price) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isLow && (
                            <button title="Add to order"
                              onClick={() => addToOrder({ product_id: p.id, name: p.name, company_id: p.company_id, reorder_level: p.reorder_level })}
                              className="p-1.5 rounded-lg text-green-400 hover:bg-green-900/30 transition-colors">
                              <ShoppingCart size={14} />
                            </button>
                          )}
                          <button title="Edit product" onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button title="Delete product" onClick={() => setDeleteId(p.id)}
                            className="p-1.5 rounded-lg text-[#8b949e] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-[rgba(48,54,61,0.5)] text-[#8b949e] text-xs">
              {filtered.length} products{search ? ` matching "${search}"` : ''}
            </div>
          </div>
        </>
      )}

      {/* Product modal */}
      {showModal && (
        <ProductModal
          product={editProduct}
          companies={companies}
          onClose={() => { setShowModal(false); setEditProduct(null) }}
          onSave={(body) => saveMutation.mutate(body)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        title="Delete Product"
        message="This will mark the product as inactive. It won't appear in searches or orders."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Layout>
  )
}
