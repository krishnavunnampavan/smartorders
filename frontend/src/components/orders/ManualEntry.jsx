import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'

export default function ManualEntry() {
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [qty, setQty] = useState(1)
  const addResolvedItem = useOrderStore((s) => s.addResolvedItem)

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => client.get('/products').then((r) => r.data),
  })

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  ) || []

  const handleAdd = () => {
    if (!selectedProduct) return
    addResolvedItem({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      company_id: selectedProduct.company_id,
      quantity: qty,
      source: 'manual',
    })
    setSearch('')
    setSelectedProduct(null)
    setQty(1)
    toast.success(`Added ${selectedProduct.name}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[#8b949e] text-xs mb-1 uppercase tracking-wide">
          Search Product
        </label>
        <input
          className="input-field"
          placeholder="Type product name or SKU…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null) }}
        />
        {search && !selectedProduct && filtered.length > 0 && (
          <div className="mt-1 border border-[rgba(48,54,61,0.8)] rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-[#161b22]">
            {filtered.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-2.5 hover:bg-[rgba(48,54,61,0.5)] text-[#e6edf3] text-sm flex justify-between"
                onClick={() => { setSelectedProduct(p); setSearch(p.name) }}
              >
                <span>{p.name}</span>
                <span className="text-[#8b949e] text-xs">{p.unit_size}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="glass-card p-4">
          <p className="text-[#e6edf3] font-medium">{selectedProduct.name}</p>
          <p className="text-[#8b949e] text-xs mt-0.5">
            {selectedProduct.unit_size} · {selectedProduct.category}
          </p>
        </div>
      )}

      <div>
        <label className="block text-[#8b949e] text-xs mb-1 uppercase tracking-wide">Cases</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="input-field w-32"
        />
      </div>

      <button
        className="btn-primary flex items-center gap-2"
        onClick={handleAdd}
        disabled={!selectedProduct}
      >
        <Plus size={16} /> Add to Order
      </button>
    </div>
  )
}
