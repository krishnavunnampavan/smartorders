import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import client from '../api/client'

export default function InventoryPage() {
  const qc = useQueryClient()
  const [updateMap, setUpdateMap] = useState({})
  const [search, setSearch] = useState('')

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
      {alerts?.length > 0 && (
        <div className="glass-card p-4 mb-4 border border-red-800/50 bg-red-900/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-red-400 font-semibold text-sm">Low Stock ({alerts.length})</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <span key={a.product_id} className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded-full">
                {a.name} — {a.current_stock}/{a.reorder_level}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <input className="input-field" placeholder="Search products…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Mobile: card list; Desktop: table */}
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
                <input type="number" min={0} className="input-field flex-1 py-1.5 text-sm"
                  placeholder={`New qty (current: ${p.current_stock})`}
                  value={updateMap[p.id] ?? ''}
                  onChange={(e) => setUpdateMap((m) => ({ ...m, [p.id]: parseInt(e.target.value) }))} />
                <button className="btn-primary text-sm py-1.5 px-4 shrink-0"
                  onClick={() => updateMutation.mutate({ id: p.id, stock: updateMap[p.id] })}
                  disabled={updateMap[p.id] == null}>
                  Save
                </button>
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
                      <input type="number" min={0} className="input-field w-20 py-1 text-sm"
                        placeholder={String(p.current_stock)}
                        value={updateMap[p.id] ?? ''}
                        onChange={(e) => setUpdateMap((m) => ({ ...m, [p.id]: parseInt(e.target.value) }))} />
                      <button className="btn-primary text-xs py-1.5 px-3"
                        onClick={() => updateMutation.mutate({ id: p.id, stock: updateMap[p.id] })}
                        disabled={updateMap[p.id] == null}>
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
