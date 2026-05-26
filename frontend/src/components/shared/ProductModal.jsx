import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export const PRODUCT_CATEGORIES = [
  'Beer & RTD', 'Wine', 'Vodka', 'Whiskey & Cognac',
  'Tequila & Mezcal', 'Rum', 'Gin', 'Liqueurs & Cordials',
  'Non-Alcoholic', 'Tobacco', 'Spirits & Other',
]

const SIZE_OPTS = [
  '50ml','100ml','187ml','200ml','375ml','500ml','750ml',
  '1L','1.75L','3L','4L','5L','12 Oz','16 Oz','24 Oz','Other',
]

const EMPTY = {
  name: '', sku: '', barcode: '', category: '', brand: '', unit_size: '',
  company_id: '', reorder_level: 2, current_stock: 0, aliases: [],
  is_active: true,
}

export default function ProductModal({ product, companies, onClose, onSave, showBrandPropagate = false }) {
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
  } : { ...EMPTY })
  const [aliasInput, setAliasInput] = useState('')
  const [propagateBrand, setPropagateBrand] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const addAlias = () => {
    const a = aliasInput.trim().toLowerCase()
    if (a && !form.aliases.includes(a)) set('aliases', [...form.aliases, a])
    setAliasInput('')
  }

  const submit = () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    const body = { ...form }
    if (!body.company_id) delete body.company_id
    onSave(body, propagateBrand && showBrandPropagate)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#e6edf3] font-semibold text-lg">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]">
            <X size={20} />
          </button>
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
              {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
              <input className="input-field flex-1" placeholder='"henny", "jack"'
                value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())} />
              <button className="btn-secondary px-3" onClick={addAlias}>Add</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.aliases.map((a) => (
                <span key={a} className="flex items-center gap-1 bg-[#21262d] text-[#8b949e] text-xs px-2 py-1 rounded-full">
                  {a}
                  <button onClick={() => set('aliases', form.aliases.filter((x) => x !== a))}
                    className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="pm_is_active" checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)} className="accent-[#58a6ff]" />
            <label htmlFor="pm_is_active" className="text-[#8b949e] text-sm cursor-pointer">Active</label>
          </div>

          {showBrandPropagate && form.brand && form.company_id && (
            <div className="col-span-2 flex items-start gap-2 p-3 rounded-lg bg-[#58a6ff]/8 border border-[#58a6ff]/20">
              <input type="checkbox" id="pm_propagate" checked={propagateBrand}
                onChange={(e) => setPropagateBrand(e.target.checked)} className="accent-[#58a6ff] mt-0.5" />
              <label htmlFor="pm_propagate" className="text-[#8b949e] text-xs cursor-pointer leading-relaxed">
                Apply this distributor to <strong className="text-[#e6edf3]">all {form.brand} products</strong>
                <span className="block text-[#8b949e]/70 mt-0.5">
                  Every product with brand "{form.brand}" will be assigned to the same company
                </span>
              </label>
            </div>
          )}
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
