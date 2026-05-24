import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore, calcUnitPrice } from '../../store/orderStore'
import { useDebounce } from '../../hooks/useDebounce'
import PriceTagBadge from '../shared/PriceTagBadge'

const CATEGORIES = [
  'All',
  'Beer & RTD', 'Wine', 'Vodka', 'Whiskey & Cognac',
  'Tequila & Mezcal', 'Rum', 'Gin', 'Liqueurs & Cordials',
  'Non-Alcoholic', 'Tobacco', 'Spirits & Other',
]

const STANDARD_SIZES = ['50ml', '100ml', '200ml', '375ml', '500ml', '750ml', '1L', '1.75L']
const DEFAULT_UNIT_OPTS = [
  { unit_label: 'Bottle',     bottles_per_unit: 1 },
  { unit_label: 'Half Case',  bottles_per_unit: 6 },
  { unit_label: 'Case',       bottles_per_unit: 12 },
  { unit_label: 'Mixed Case', bottles_per_unit: 12 },
]

function SelectBox({ value, options, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-[rgba(48,54,61,0.5)] border border-[rgba(48,54,61,0.5)] text-[#e6edf3] text-[10px] rounded-md px-2 py-1 pr-5 focus:outline-none focus:border-[#58a6ff]/50 cursor-pointer"
      >
        {options.map((o) => (
          <option key={typeof o === 'string' ? o : o.unit_label || o.size_label}
            value={typeof o === 'string' ? o : o.unit_label || o.size_label}>
            {typeof o === 'string' ? o : o.unit_label || o.size_label}
          </option>
        ))}
      </select>
      <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
    </div>
  )
}

export default function ManualEntry() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  // Per-product local state: { [productId]: { qty, size, unit } }
  const [localState, setLocalState] = useState({})

  const debouncedSearch = useDebounce(search, 200)
  const { items, addItem, removeItem, updateItemQty } = useOrderStore()

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

  const getLocal = (pid, p) => {
    const s = localState[pid]
    const casePack = parseCasePack(p?.pack)
    const defaultUnit = { unit_label: 'Case', bottles_per_unit: casePack }
    return {
      qty: s?.qty ?? 1,
      size: s?.size ?? '750ml',
      unit: s?.unit ?? 'Case',
      unitOpt: s?.unitOpt ?? defaultUnit,
    }
  }

  function parseCasePack(packStr) {
    if (!packStr) return 12
    const n = parseInt(String(packStr).split('/')[0], 10)
    return isNaN(n) ? 12 : n
  }

  const setLocal = (pid, field, value) =>
    setLocalState((prev) => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))

  const inOrder = (pid) => items.some((i) => i.product_id === pid)
  const orderItem = (pid) => items.find((i) => i.product_id === pid)

  const getSizeOptions = (p) => {
    if (p.size_options?.length) return p.size_options.map((s) => s.size_label ?? s)
    return STANDARD_SIZES
  }

  const getUnitOptions = (p) => {
    if (p.unit_options?.length) return p.unit_options
    const casePack = parseCasePack(p.pack)
    return [
      { unit_label: 'Bottle',     bottles_per_unit: 1 },
      { unit_label: 'Half Case',  bottles_per_unit: Math.max(1, Math.floor(casePack / 2)) },
      { unit_label: 'Case',       bottles_per_unit: casePack },
      { unit_label: 'Mixed Case', bottles_per_unit: casePack },
    ]
  }

  const getEffectivePrice = (p, sizeLabel, unitLabel) => {
    const casePack = parseCasePack(p.pack)
    const res = calcUnitPrice(p.unit_price, sizeLabel, unitLabel, casePack)
    return res?.unitPrice
  }

  const addToOrder = (p) => {
    const { qty, size, unit } = getLocal(p.id, p)
    const unitOpts = getUnitOptions(p)
    const sizeOpts = getSizeOptions(p).map((sl) => {
      const found = (p.size_options || []).find((s) => (s.size_label ?? s) === sl)
      return found || { size_label: sl }
    })
    const sizeOpt = sizeOpts.find((s) => (s.size_label ?? s) === size) || { size_label: size }
    const unitOpt = unitOpts.find((u) => u.unit_label === unit) || { unit_label: unit, bottles_per_unit: 12 }

    addItem(
      { ...p, product_id: p.id, product_name: p.name, source: 'manual' },
      sizeOpt, unitOpt, qty
    )
    setLocalState((prev) => ({ ...prev, [p.id]: { qty: 1, size: '750ml', unit: 'Case' } }))
    toast.success(`Added ${p.name}`, { duration: 1200 })
  }

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
      <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
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
          const { qty, size, unit } = getLocal(p.id, p)
          const sizeOptions = getSizeOptions(p)
          const unitOptions = getUnitOptions(p)
          const effectivePrice = getEffectivePrice(p, size, unit)
          const casePack = parseCasePack(p.pack)
          const bpu = unitOptions.find((u) => u.unit_label === unit)?.bottles_per_unit ?? casePack
          const totalBottles = qty * bpu

          return (
            <div key={p.id}
              className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                ordered
                  ? 'bg-green-900/15 border border-green-800/40'
                  : 'bg-[rgba(22,27,34,0.5)] border border-[rgba(48,54,61,0.4)] hover:border-[rgba(48,54,61,0.8)]'
              }`}>
              {/* Name row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[#e6edf3] text-sm font-medium leading-tight truncate">
                    {highlight(p.name, debouncedSearch)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.category && <span className="text-[#484f58] text-xs">{p.category}</span>}
                    {p.price_status && <PriceTagBadge status={p.price_status} />}
                    {ordered && <span className="text-green-400 text-xs font-medium">✓ In order</span>}
                  </div>
                </div>
              </div>

              {/* Size / Unit / Qty controls */}
              {!ordered && (
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Size</p>
                    <SelectBox
                      value={size}
                      options={sizeOptions}
                      onChange={(v) => setLocal(p.id, 'size', v)}
                    />
                  </div>
                  <div>
                    <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Unit</p>
                    <SelectBox
                      value={unit}
                      options={unitOptions}
                      onChange={(v) => setLocal(p.id, 'unit', v)}
                    />
                  </div>
                  <div>
                    <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Qty</p>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center text-sm hover:bg-[rgba(48,54,61,1)]"
                        onClick={() => setLocal(p.id, 'qty', Math.max(1, qty - 1))}>
                        −
                      </button>
                      <span className="text-[#e6edf3] font-mono text-sm w-5 text-center">{qty}</span>
                      <button
                        className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center text-sm hover:bg-[rgba(48,54,61,1)]"
                        onClick={() => setLocal(p.id, 'qty', qty + 1)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Price + add button row */}
              {!ordered ? (
                <div className="flex items-center justify-between">
                  <div className="text-[#8b949e] text-[10px]">
                    {effectivePrice != null && (
                      <span className="text-[#58a6ff] font-mono">${effectivePrice.toFixed(2)}/{unit.toLowerCase()}</span>
                    )}
                    <span className="ml-1 text-[#484f58]">· {totalBottles} btl</span>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
                    onClick={() => addToOrder(p)}>
                    Add to order
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8b949e] text-xs">
                      {orderItem(p.id)?.selected_size} · {orderItem(p.id)?.selected_unit} ×{orderItem(p.id)?.quantity}
                    </span>
                  </div>
                  <button
                    className="text-[#8b949e] hover:text-red-400 text-xs transition-colors"
                    onClick={() => removeItem(orderItem(p.id)?._key)}>
                    Remove
                  </button>
                </div>
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
