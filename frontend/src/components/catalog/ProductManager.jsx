import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

const EMPTY = {
  name: '', sku: '', barcode: '', category: 'spirits', subcategory: '',
  brand: '', unit_size: '750ml', case_pack: 12, company_id: '',
  reorder_level: 2,
}

export default function ProductManager() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [aliasInput, setAliasInput] = useState('')

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get('/products').then((r) => r.data),
  })
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editing ? client.put(`/products/${editing}`, body) : client.post('/products', body),
    onSuccess: () => {
      qc.invalidateQueries(['products'])
      setForm(EMPTY)
      setEditing(null)
      toast.success(editing ? 'Product updated' : 'Product created')
    },
  })

  const aliasMutation = useMutation({
    mutationFn: ({ id, alias }) => client.post(`/products/${id}/alias?alias=${encodeURIComponent(alias)}`),
    onSuccess: () => { qc.invalidateQueries(['products']); setAliasInput('') },
  })

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Form */}
      <div className="glass-card p-5">
        <h2 className="text-[#e6edf3] font-semibold mb-4">
          {editing ? 'Edit Product' : 'Add Product'}
        </h2>
        <div className="space-y-3">
          {[['name', 'Name *'], ['sku', 'SKU'], ['barcode', 'Barcode'], ['brand', 'Brand'], ['unit_size', 'Unit Size']].map(([k, l]) => (
            <div key={k}>
              <label className="block text-[#8b949e] text-xs mb-1">{l}</label>
              <input className="input-field" value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Category</label>
            <select className="input-field" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {['spirits', 'wine', 'beer', 'mixer', 'other'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Distributor</label>
            <select className="input-field" value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}>
              <option value="">— select —</option>
              {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[#8b949e] text-xs mb-1">Case Pack</label>
              <input type="number" className="input-field" value={form.case_pack} onChange={(e) => setForm((f) => ({ ...f, case_pack: parseInt(e.target.value) }))} />
            </div>
            <div className="flex-1">
              <label className="block text-[#8b949e] text-xs mb-1">Reorder Level</label>
              <input type="number" className="input-field" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: parseInt(e.target.value) }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => saveMutation.mutate(form)} disabled={!form.name}>
            <Plus size={15} /> {editing ? 'Update' : 'Create'}
          </button>
          {editing && <button className="btn-secondary text-sm" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel</button>}
        </div>
      </div>

      {/* Product list with alias training */}
      <div className="col-span-2 space-y-2 max-h-[70vh] overflow-y-auto">
        {products?.map((p) => (
          <div key={p.id} className="glass-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#e6edf3] font-medium">{p.name}</p>
                <p className="text-[#8b949e] text-xs">{p.category} · {p.unit_size} · SKU: {p.sku || '—'}</p>
                {p.aliases?.length > 0 && (
                  <p className="text-xs text-[#58a6ff] mt-1">
                    Aliases: {p.aliases.join(', ')}
                  </p>
                )}
              </div>
              <button className="text-xs text-[#8b949e] hover:text-accent-blue" onClick={() => { setEditing(p.id); setForm({ ...p, company_id: p.company_id || '' }) }}>
                Edit
              </button>
            </div>
            {/* Add alias */}
            {editing === p.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-[rgba(48,54,61,0.5)]">
                <input
                  className="input-field flex-1 text-xs py-1"
                  placeholder="Add alias (e.g. henny)"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                />
                <button
                  className="btn-secondary text-xs py-1"
                  onClick={() => aliasMutation.mutate({ id: p.id, alias: aliasInput })}
                  disabled={!aliasInput}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
