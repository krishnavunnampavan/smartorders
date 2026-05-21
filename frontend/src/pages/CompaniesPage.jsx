import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import ConfirmModal from '../components/shared/ConfirmModal'
import client from '../api/client'

const EMPTY = { name: '', contact_name: '', email: '', phone: '', delivery_days: '', notes: '' }

export default function CompaniesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (body) =>
      editing
        ? client.put(`/companies/${editing}`, body)
        : client.post('/companies', body),
    onSuccess: () => {
      qc.invalidateQueries(['companies'])
      setForm(EMPTY)
      setEditing(null)
      toast.success(editing ? 'Company updated' : 'Company created')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/companies/${id}`),
    onSuccess: () => { qc.invalidateQueries(['companies']); setDeleting(null) },
  })

  const startEdit = (c) => {
    setEditing(c.id)
    setForm({
      name: c.name || '', contact_name: c.contact_name || '',
      email: c.email || '', phone: c.phone || '',
      delivery_days: c.delivery_days || '', notes: c.notes || '',
    })
  }

  return (
    <Layout title="Companies (Distributors)">
      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="glass-card p-5">
          <h2 className="text-[#e6edf3] font-semibold mb-4">
            {editing ? 'Edit Company' : 'Add Company'}
          </h2>
          <div className="space-y-3">
            {[
              ['name', 'Name *'],
              ['contact_name', 'Contact Name'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['delivery_days', 'Delivery Days (e.g. Mon, Wed)'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-[#8b949e] text-xs mb-1">{label}</label>
                <input
                  className="input-field"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-[#8b949e] text-xs mb-1">Notes</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name || saveMutation.isPending}
            >
              <Plus size={16} /> {editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button className="btn-secondary" onClick={() => { setEditing(null); setForm(EMPTY) }}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Company list */}
        <div className="col-span-2 space-y-3">
          {companies?.map((c) => (
            <div key={c.id} className="glass-card p-4 flex items-start justify-between">
              <div>
                <p className="text-[#e6edf3] font-medium">{c.name}</p>
                <p className="text-[#8b949e] text-xs mt-0.5">
                  {c.contact_name && `${c.contact_name} · `}
                  {c.email && `${c.email} · `}
                  {c.delivery_days && `Deliveries: ${c.delivery_days}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="p-2 text-[#8b949e] hover:text-accent-blue transition-colors"
                  onClick={() => startEdit(c)}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className="p-2 text-[#8b949e] hover:text-red-400 transition-colors"
                  onClick={() => setDeleting(c.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!companies?.length && (
            <div className="glass-card p-12 text-center text-[#8b949e]">
              No companies yet. Add your first distributor.
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleting}
        title="Delete Company"
        message="This will soft-delete the company. Are you sure?"
        onConfirm={() => deleteMutation.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </Layout>
  )
}
