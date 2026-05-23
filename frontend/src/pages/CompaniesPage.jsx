import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, ChevronRight, X, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import ConfirmModal from '../components/shared/ConfirmModal'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMPTY = {
  name: '', contact_name: '', email: '', phone: '',
  delivery_days: '', min_order_value: '', notes: '',
}

function parseDays(str) {
  if (!str) return []
  return str.split(',').map((d) => d.trim()).filter(Boolean)
}

function CompanyModal({ company, onClose, onSave }) {
  const [form, setForm] = useState(company ? {
    name: company.name || '',
    contact_name: company.contact_name || '',
    email: company.email || '',
    phone: company.phone || '',
    delivery_days: company.delivery_days || '',
    min_order_value: company.min_order_value || '',
    notes: company.notes || '',
  } : { ...EMPTY })

  const selectedDays = parseDays(form.delivery_days)
  const toggleDay = (day) => {
    const days = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day]
    setForm((f) => ({ ...f, delivery_days: days.join(', ') }))
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return }
    onSave({ ...form, min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#e6edf3] font-semibold">{company ? 'Edit Company' : 'Add Company'}</h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Company Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#8b949e] text-xs mb-1">Contact Person</label>
              <input className="input-field" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-[#8b949e] text-xs mb-1">Phone</label>
              <input className="input-field" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-2">Delivery Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d) => (
                <button key={d} onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedDays.includes(d)
                      ? 'bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/40'
                      : 'bg-[#161b22] text-[#8b949e] border border-[rgba(48,54,61,0.8)]'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Min. Order Value ($)</label>
            <input type="number" min={0} step="0.01" className="input-field"
              value={form.min_order_value} onChange={(e) => set('min_order_value', e.target.value)} />
          </div>
          <div>
            <label className="block text-[#8b949e] text-xs mb-1">Notes</label>
            <textarea className="input-field resize-none" rows={2} value={form.notes}
              onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" onClick={submit}>
            {company ? 'Save Changes' : 'Create Company'}
          </button>
          <button className="btn-secondary px-4" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ProductsPanel({ company, onClose }) {
  const [search, setSearch] = useState('')
  const [pickMode, setPickMode] = useState(false)
  const qc = useQueryClient()

  const { data: assigned, isLoading } = useQuery({
    queryKey: ['company-products', company.id],
    queryFn: () => client.get(`/companies/${company.id}/products`).then((r) => r.data),
  })
  const { data: allProducts } = useQuery({
    queryKey: ['products', '', '', 1],
    queryFn: () => client.get('/products?per_page=200').then((r) => r.data),
    enabled: pickMode,
  })

  const unassignMutation = useMutation({
    mutationFn: (pid) => client.delete(`/companies/${company.id}/unassign`, { data: { product_ids: [pid] } }),
    onSuccess: () => { qc.invalidateQueries(['company-products', company.id]); toast.success('Unassigned') },
  })
  const assignMutation = useMutation({
    mutationFn: (pid) => client.post(`/companies/${company.id}/assign`, { product_ids: [pid] }),
    onSuccess: () => {
      qc.invalidateQueries(['company-products', company.id])
      qc.invalidateQueries(['products'])
      toast.success('Assigned')
    },
  })

  const assignedIds = new Set((assigned || []).map((p) => p.id))
  const unassigned = (allProducts || []).filter((p) => !assignedIds.has(p.id))
  const filteredUnassigned = unassigned.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="glass-card w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[rgba(48,54,61,0.8)]">
          <div>
            <h2 className="text-[#e6edf3] font-semibold">{company.name}</h2>
            <p className="text-[#8b949e] text-xs">{assigned?.length || 0} products assigned</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs py-1.5" onClick={() => setPickMode(!pickMode)}>
              {pickMode ? 'View Assigned' : '+ Assign Products'}
            </button>
            <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]"><X size={18} /></button>
          </div>
        </div>

        {pickMode ? (
          <div className="flex-1 overflow-y-auto p-4">
            <input className="input-field mb-3" placeholder="Search products to assign…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="space-y-1">
              {filteredUnassigned.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(22,27,34,0.5)]">
                  <div>
                    <p className="text-[#e6edf3] text-sm">{p.name}</p>
                    <p className="text-[#8b949e] text-xs">{p.unit_size} · {p.category}</p>
                  </div>
                  <button className="btn-primary text-xs py-1 px-3"
                    onClick={() => assignMutation.mutate(p.id)}>Assign</button>
                </div>
              ))}
              {filteredUnassigned.length === 0 && (
                <p className="text-[#8b949e] text-sm text-center py-6">
                  {search ? `No results for "${search}"` : 'All products already assigned'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <div className="space-y-1">
                {assigned?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(22,27,34,0.5)]">
                    <div>
                      <p className="text-[#e6edf3] text-sm">{p.name}</p>
                      <p className="text-[#8b949e] text-xs">{p.unit_size} · {p.category}</p>
                    </div>
                    <button className="text-[#8b949e] hover:text-red-400 text-xs px-2 py-1"
                      onClick={() => unassignMutation.mutate(p.id)}>Unassign</button>
                  </div>
                ))}
                {!assigned?.length && (
                  <p className="text-[#8b949e] text-sm text-center py-8">
                    No products assigned yet. Click "+ Assign Products" to add some.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editCompany, setEditCompany] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [productsPanel, setProductsPanel] = useState(null)

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editCompany?.id
        ? client.put(`/companies/${editCompany.id}`, body)
        : client.post('/companies', body),
    onSuccess: () => {
      qc.invalidateQueries(['companies'])
      setShowModal(false)
      setEditCompany(null)
      toast.success(editCompany?.id ? 'Company updated' : 'Company created')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/companies/${id}`),
    onSuccess: () => { qc.invalidateQueries(['companies']); setDeleteId(null) },
  })

  const openAdd = () => { setEditCompany(null); setShowModal(true) }
  const openEdit = (c) => { setEditCompany(c); setShowModal(true) }

  return (
    <Layout title="Companies (Distributors)">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[#8b949e] text-sm">{companies?.length || 0} companies</p>
        <button className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus size={15} /> Add Company
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-3">
          {companies?.map((c) => (
            <div key={c.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[#e6edf3] font-semibold">{c.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {c.contact_name && (
                      <span className="text-[#8b949e] text-xs">{c.contact_name}</span>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-[#58a6ff] text-xs hover:underline">{c.email}</a>
                    )}
                    {c.phone && <span className="text-[#8b949e] text-xs">{c.phone}</span>}
                    {c.delivery_days && (
                      <span className="text-[#8b949e] text-xs">📦 {c.delivery_days}</span>
                    )}
                    {c.min_order_value && (
                      <span className="text-[#8b949e] text-xs">Min: ${parseFloat(c.min_order_value).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#8b949e] hover:text-[#58a6ff] transition-colors"
                    onClick={() => setProductsPanel(c)}>
                    <Package size={13} /> Products
                  </button>
                  <button className="p-1.5 text-[#8b949e] hover:text-[#58a6ff]" onClick={() => openEdit(c)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="p-1.5 text-[#8b949e] hover:text-red-400" onClick={() => setDeleteId(c.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!companies?.length && (
            <div className="glass-card p-16 text-center">
              <Package size={36} className="mx-auto text-[#484f58] mb-3" />
              <p className="text-[#8b949e]">No companies yet.</p>
              <p className="text-[#484f58] text-sm mt-1">Add your first distributor to get started.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CompanyModal
          company={editCompany}
          onClose={() => { setShowModal(false); setEditCompany(null) }}
          onSave={(body) => saveMutation.mutate(body)}
        />
      )}
      {productsPanel && (
        <ProductsPanel company={productsPanel} onClose={() => setProductsPanel(null)} />
      )}
      <ConfirmModal
        open={!!deleteId}
        title="Delete Company"
        message="This will deactivate the company. Assigned products will be unlinked."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </Layout>
  )
}
