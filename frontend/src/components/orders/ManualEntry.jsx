import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'
import { useDebounce } from '../../hooks/useDebounce'
import PriceTagBadge from '../shared/PriceTagBadge'

const CATEGORIES = [
  'All',
  'Beer & RTD', 'Wine', 'Vodka', 'Whiskey & Cognac',
  'Tequila & Mezcal', 'Rum', 'Gin', 'Liqueurs & Cordials',
  'Non-Alcoholic', 'Tobacco', 'Spirits & Other',
]

export default function ManualEntry() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [localQty, setLocalQty] = useState({})

  const debouncedSearch = useDebounce(search, 200)
  const { resolvedItems, addResolvedItem, updateResolvedQty, removeResolvedItem } = useOrderStore()

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-manual', debouncedSearch, category],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: 50 })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (category !== 'All') params.set('category', category)
      return client.get(`/products?${params}`).then((r) => r.data)
    },
    keepPreviousData: true,
  })

  const getOrderQty = (productId) =>
    resolvedItems.find((i) => i.product_id === productId)?.quantity || 0

  const getLocalQty = (productId) => localQty[productId] ?? 1

  const increment = (p) => {
    const inOrder = resolvedItems.find((i) => i.product_id === p.id)
    if (inOrder) {
      updateResolvedQty(p.id, inOrder.quantity + 1)
    } else {
      setLocalQty((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 1) + 1 }))
    }
  }

  const decrement = (p) => {
    const inOrder = resolvedItems.find((i) => i.product_id === p.id)
    if (inOrder) {
      if (inOrder.quantity <= 1) removeResolvedItem(p.id)
      else updateResolvedQty(p.id, inOrder.quantity - 1)
    } else {
      setLocalQty((prev) => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] ?? 1) - 1) }))
    }
  }

  const addToOrder = (p) => {
    const qty = getLocalQty(p.id)
    addResolvedItem({
      product_id: p.id,
      product_name: p.name,
      company_id: p.company_id,
      quantity: qty,
      unit_price: p.unit_price,
      price_status: p.price_status,
      source: 'manual',
    })
    setLocalQty((prev) => ({ ...prev, [p.id]: 1 }))
    toast.success(`Added ${p.name}`, { duration: 1200 })
  }

  const inOrder = (productId) => resolvedItems.some((i) => i.product_id === productId)

  const highlight = (text, query) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
        <input
          className="input-field pl-9 pr-9"
          placeholder="Search products…"
          value={search}
          autoFocus
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
            onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              category === c
                ? 'bg-[#58a6ff]/20 text-[#58a6ff]'
                : 'bg-[#0d1117] text-[#8b949e] hover:text-[#e6edf3]'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-1 max-h-[52vh] overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="py-8 text-center text-[#8b949e] text-sm">Loading…</div>
        )}
        {!isLoading && (!products || products.length === 0) && (
          <div className="py-8 text-center text-[#8b949e] text-sm">
            {search ? `No results for "${search}"` : 'No products found.'}
          </div>
        )}
        {products?.map((p) => {
          const ordered = inOrder(p.id)
          const displayQty = ordered ? getOrderQty(p.id) : getLocalQty(p.id)

          return (
            <div key={p.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                ordered
                  ? 'bg-green-900/20 border border-green-800/40'
                  : 'bg-[rgba(22,27,34,0.5)] border border-[rgba(48,54,61,0.4)] hover:border-[rgba(48,54,61,0.8)]'
              }`}>
              <div className="flex-1 min-w-0">
                <p className="text-[#e6edf3] text-sm font-medium leading-tight truncate">
                  {highlight(p.name, debouncedSearch)}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.unit_size && <span className="text-[#8b949e] text-xs">{p.unit_size}</span>}
                  {p.category && <span className="text-[#484f58] text-xs">{p.category}</span>}
                  {p.price_status && <PriceTagBadge status={p.price_status} />}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="w-7 h-7 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center hover:bg-[rgba(48,54,61,1)]"
                  onClick={() => decrement(p)}>
                  <Minus size={12} />
                </button>
                <span className="text-[#e6edf3] font-mono text-sm w-6 text-center select-none">
                  {displayQty}
                </span>
                <button
                  className="w-7 h-7 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center hover:bg-[rgba(48,54,61,1)]"
                  onClick={() => increment(p)}>
                  <Plus size={12} />
                </button>
              </div>

              {!ordered ? (
                <button
                  className="shrink-0 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
                  onClick={() => addToOrder(p)}>
                  Add
                </button>
              ) : (
                <span className="shrink-0 text-green-400 text-xs font-medium">✓</span>
              )}
            </div>
          )
        })}
      </div>

      {products?.length === 50 && (
        <p className="text-[#8b949e] text-xs text-center">Showing top 50 — search to narrow</p>
      )}
    </div>
  )
}
