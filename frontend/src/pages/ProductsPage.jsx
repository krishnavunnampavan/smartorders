import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Edit2, Trash2, Package, Search, X, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import ConfirmModal from '../components/shared/ConfirmModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { useDebounce } from '../hooks/useDebounce'

const CATEGORIES = [
  'All',
  'Beer & RTD', 'Wine', 'Vodka', 'Whiskey & Cognac',
  'Tequila & Mezcal', 'Rum', 'Gin', 'Liqueurs & Cordials',
  'Non-Alcoholic', 'Tobacco', 'Spirits & Other',
]

const SIZE_OPTS = ['50ml','100ml','187ml','200ml','375ml','500ml','750ml','1L','1.75L','3L','4L','5L','12 Oz','16 Oz','24 Oz','Other']
const EMPTY_FORM = {
  name: '', sku: '', barcode: '', category: '', brand: '', unit_size: '',
  company_id: '', reorder_level: 2, current_stock: 0, aliases: [], notes: '', is_active: true,
}

function CategoryBadge({ category }) {
  const colors = {
    'Beer & RTD': 'bg-amber-900/40 text-amber-300',
    'Wine': 'bg-purple-900/40 text-purple-300',
    'Vodka': 'bg-blue-900/40 text-blue-300',
    'Whiskey & Cognac': 'bg-orange-900/40 text-orange-300',
    'Tequila & Mezcal': 'bg-green-900/40 text-green-300',
    'Rum': 'bg-yellow-900/40 text-yellow-300',
    'Gin': 'bg-teal-900/40 text-teal-300',
    'Liqueurs & Cordials': 'bg-pink-900/40 text-pink-300',
    'Non-Alcoholic': 'bg-gray-800 text-gray-300',
    'Tobacco': 'bg-stone-800 text-stone-300',
    'Spirits & Other': 'bg-indigo-900/40 text-indigo-300',
  }
  const cls = colors[category] || 'bg-gray-800 text-gray-300'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{category || '—'}</span>
}

function StockBadge({ current, reorder }) {
  if (current > reorder) return <span className="text-green-400 font-mono text-xs">{current}</span>
  if (current === reorder) return <span className="text-yellow-400 font-mono text-xs">{current}</span>
  return <span className="text-red-400 font-mono text-xs font-bold">{current}</span>
}

function ProductModal({ product, companies, onClose, onSave }) {
  const [form, setForm] = useState(product ? {
    name: product.name || '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    category: product.category || '',
    brand: product.brand || '',
    unit_size: product.unit_size || '',
    company_id: product.company_id || '',
    reorder_level: product.reorder_level ?? 2,
    current_stock: product.current_stock ?? 0,
    aliases: product.aliases || [],
    is_active: product.is_active ?? true,
  } : { ...EMPTY_FORM })
  const [aliasInput, setAliasInput] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const addAlias = () => {
    const a = aliasInput.trim().toLowerCase()
    if (a && !form.aliases.includes(a)) {
      set('aliases', [...form.aliases, a])
    }
    setAliasInput('')
  }

  const submit = () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    const body = { ...form }
    if (!body.company_id) delete body.company_id
    onSave(body)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#e6edf3] font-semibold text-lg">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[#8b949e] text-xs mb-1">Product Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">SKU</label>
            <input className="input-field" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">UPC / Barcode</label>
            <input className="input-field" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Brand</label>
            <input className="input-field" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Category</label>
            <select className="input-field" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select category…</option>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Size</label>
            <select className="input-field" value={form.unit_size} onChange={(e) => set('unit_size', e.target.value)}>
              <option value="">Select size…</option>
              {SIZE_OPTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Distributor</label>
            <select className="input-field" value={form.company_id} onChange={(e) => set('company_id', e.target.value)}>
              <option value="">Unassigned</option>
              {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Reorder Level</label>
            <input type="number" min={0} className="input-field" value={form.reorder_level}
              onChange={(e) => set('reorder_level', parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Current Stock</label>
            <input type="number" min={0} className="input-field" value={form.current_stock}
              onChange={(e) => set('current_stock', parseInt(e.target.value) || 0)} />
          </div>

          <div className="col-span-2">
            <label className="block text-[#8b949e] text-xs mb-1">Aliases (for voice/AI matching)</label>
            <div className="flex gap-2 mb-2">
              <input className="input-field flex-1" placeholder='e.g. "henny", "jack"'
                value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())} />
              <button className="btn-secondary px-3" onClick={addAlias}>Add</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.aliases.map((a) => (
                <span key={a} className="flex items-center gap-1 bg-[#21262d] text-[#8b949e] text-xs px-2 py-1 rounded-full">
                  {a}
                  <button onClick={() => set('aliases', form.aliases.filter((x) => x !== a))} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)} className="accent-[#58a6ff]" />
            <label htmlFor="is_active" className="text-[#8b949e] text-sm cursor-pointer">Active</label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" onClick={submit}>
            {product ? 'Save Changes' : 'Create Product'}
          </button>
          <button className="btn-secondary px-4" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function StockModal({ product, onClose, onSave }) {
  const [newStock, setNewStock] = useState(product.current_stock)
  const [reason, setReason] = useState('delivery')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="glass-card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e6edf3] font-semibold">Update Stock</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]"><X size={18} /></button>
        </div>
        <p className="text-[#8b949e] text-sm mb-4 truncate">{product.name}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">New Stock Count</label>
            <input type="number" min={0} className="input-field" value={newStock}
              onChange={(e) => setNewStock(parseInt(e.target.value) || 0)} />
            <p className="text-xs text-[#8b949e] mt-1">Current: {product.current_stock}</p>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Reason</label>
            <select className="input-field" value={reason} onChange={(e) => setReason(e.target.value)}>
              {['delivery', 'sale', 'adjustment', 'correction'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn-primary flex-1" onClick={() => onSave(newStock, reason)}>Save</button>
          <button className="btn-secondary px-4" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [editProduct, setEditProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)

  const debouncedSearch = useDebounce(search, 200)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, category, page],
    queryFn: () => {
      const params = new URLSearchParams({ page, per_page: 50 })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (category !== 'All') params.set('category', category)
      return client.get(`/products?${params}`).then((r) => r.data)
    },
    keepPreviousData: true,
  })

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editProduct?.id
        ? client.put(`/products/${editProduct.id}`, body)
        : client.post('/products', body),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      setShowModal(false)
      setEditProduct(null)
      toast.success(editProduct?.id ? 'Product updated' : 'Product created')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries(['products']); setDeleteId(null) },
  })

  const stockMutation = useMutation({
    mutationFn: ({ id, stock, reason }) =>
      client.post(`/products/${id}/stock`, { new_stock: stock, change_reason: reason }),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['inventory-alerts'])
      setStockProduct(null)
      toast.success('Stock updated')
    },
  })

  const openAdd = () => { setEditProduct(null); setShowModal(true) }
  const openEdit = (p) => { setEditProduct(p); setShowModal(true) }

  const sort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...(products || [])].sort((a, b) => {
    const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ k }) =>
    sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null

  return (
    <Layout title="Items List">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input className="input-field pl-9 pr-9" placeholder="Search by name, SKU, brand…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
              onClick={() => { setSearch(''); setPage(1) }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button className="btn-primary flex items-center gap-2 shrink-0" onClick={openAdd}>
          <Plus size={15} /> Add Product
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => { setCategory(c); setPage(1) }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              category === c
                ? 'bg-[#58a6ff]/20 text-[#58a6ff]'
                : 'bg-[#161b22] text-[#8b949e] hover:text-[#e6edf3]'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-[rgba(48,54,61,0.8)] text-[#8b949e] text-xs">
                    {[
                      { k: 'name', label: 'Name' },
                      { k: 'unit_size', label: 'Size' },
                      { k: 'category', label: 'Category' },
                      { k: 'current_stock', label: 'Stock' },
                      { k: 'reorder_level', label: 'Reorder At' },
                    ].map(({ k, label }) => (
                      <th key={k} className="text-left px-4 py-3 cursor-pointer hover:text-[#e6edf3] select-none"
                        onClick={() => sort(k)}>
                        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
                      </th>
                    ))}
                    <th className="text-left px-4 py-3">Distributor</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="border-b border-[rgba(48,54,61,0.3)] hover:bg-[rgba(48,54,61,0.2)]">
                      <td className="px-4 py-3">
                        <p className="text-[#e6edf3] font-medium leading-tight">{p.name}</p>
                        {p.sku && <p className="text-[#8b949e] text-xs">{p.sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#8b949e]">{p.unit_size || '—'}</td>
                      <td className="px-4 py-3"><CategoryBadge category={p.category} /></td>
                      <td className="px-4 py-3">
                        <StockBadge current={p.current_stock} reorder={p.reorder_level} />
                      </td>
                      <td className="px-4 py-3 text-[#8b949e] text-xs">{p.reorder_level}</td>
                      <td className="px-4 py-3 text-[#8b949e] text-xs">
                        {companies?.find((c) => c.id === p.company_id)?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button title="Edit" className="p-1.5 text-[#8b949e] hover:text-[#58a6ff]"
                            onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                          <button title="Update Stock"
                            className="p-1.5 text-[#8b949e] hover:text-yellow-400"
                            onClick={() => setStockProduct(p)}>
                            <Package size={14} />
                          </button>
                          <button title="Delete" className="p-1.5 text-[#8b949e] hover:text-red-400"
                            onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-[#8b949e]">
                        {search ? `No products matching "${search}"` : 'No products found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(48,54,61,0.8)]">
              <p className="text-[#8b949e] text-xs">
                Showing {sorted.length} items{search && ` for "${search}"`}
              </p>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1 px-3" disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span className="text-[#8b949e] text-xs flex items-center px-2">Page {page}</span>
                <button className="btn-secondary text-xs py-1 px-3" disabled={sorted.length < 50}
                  onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ProductModal
          product={editProduct}
          companies={companies}
          onClose={() => { setShowModal(false); setEditProduct(null) }}
          onSave={(body) => saveMutation.mutate(body)}
        />
      )}
      {stockProduct && (
        <StockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSave={(stock, reason) => stockMutation.mutate({ id: stockProduct.id, stock, reason })}
        />
      )}
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
