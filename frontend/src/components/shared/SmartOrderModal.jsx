import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Zap, TrendingDown, ShoppingCart, ChevronRight, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'
import { formatCurrency, thisMonth } from '../../utils/formatters'
import PriceTagBadge from './PriceTagBadge'

const STATUS_COLOR = {
  DEAL: 'text-green-400',
  RECOVERY_DEAL: 'text-emerald-400',
  STABLE: 'text-[#8b949e]',
}

export default function SmartOrderModal({ onClose }) {
  const [adding, setAdding] = useState(false)
  const { addResolvedItem } = useOrderStore()
  const month = thisMonth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['smart-build', month],
    queryFn: () => client.get(`/orders/smart-build?month=${month}`).then((r) => r.data),
  })

  const items = data?.items || []
  const dealItems = items.filter((i) => i.price_status === 'DEAL' || i.price_status === 'RECOVERY_DEAL')
  const stableItems = items.filter((i) => i.price_status === 'STABLE')
  const estTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  const handleAddAll = async () => {
    if (!items.length) return
    setAdding(true)
    items.forEach((item) =>
      addResolvedItem({
        product_id: item.product_id,
        product_name: item.product_name,
        company_id: item.company_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        price_status: item.price_status,
        source: item.source,
      })
    )
    await new Promise((r) => setTimeout(r, 300))
    setAdding(false)
    toast.success(`${items.length} items added to cart`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(48,54,61,0.8)] shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" />
            <span className="text-[#e6edf3] font-semibold">Smart Order Builder</span>
            <span className="text-xs text-[#8b949e] bg-[rgba(48,54,61,0.6)] px-2 py-0.5 rounded-full">{month}</span>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3] p-1 rounded-lg hover:bg-[rgba(48,54,61,0.5)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader size={28} className="text-[#58a6ff] animate-spin" />
              <p className="text-[#8b949e] text-sm">Analysing prices & building order…</p>
            </div>
          )}

          {isError && (
            <div className="py-12 text-center text-[#8b949e] text-sm">
              No catalog data found for this month.<br />
              Upload a catalog first to use Smart Order Builder.
            </div>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <div className="py-12 text-center text-[#8b949e] text-sm">
              No items to suggest this month.<br />
              Upload a distributor catalog to enable smart ordering.
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-[#0d1117] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#e6edf3]">{items.length}</p>
                  <p className="text-[#8b949e] text-xs mt-0.5">Total items</p>
                </div>
                <div className="bg-[#0d1117] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{dealItems.length}</p>
                  <p className="text-[#8b949e] text-xs mt-0.5">Deals</p>
                </div>
                <div className="bg-[#0d1117] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[#e6edf3]">{formatCurrency(estTotal)}</p>
                  <p className="text-[#8b949e] text-xs mt-0.5">Est. total</p>
                </div>
              </div>

              {/* Deal items first */}
              {dealItems.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown size={13} className="text-green-400" />
                    <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Deals — boosted qty</span>
                  </div>
                  <div className="space-y-1.5">
                    {dealItems.map((item) => (
                      <ItemRow key={item.product_id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Stable items */}
              {stableItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-2">Stable — normal qty</p>
                  <div className="space-y-1.5">
                    {stableItems.map((item) => (
                      <ItemRow key={item.product_id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-[rgba(48,54,61,0.8)] shrink-0">
            <button
              onClick={handleAddAll}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#58a6ff] hover:bg-[#79b8ff] text-[#0d1117] transition-colors disabled:opacity-60"
            >
              {adding ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <ShoppingCart size={16} />
              )}
              {adding ? 'Adding…' : `Add All ${items.length} Items to Cart`}
              {!adding && <ChevronRight size={15} />}
            </button>
            <p className="text-center text-[#8b949e] text-xs mt-2">
              HOLD items are excluded. Review in cart before finalising.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ItemRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[rgba(22,27,34,0.6)] border border-[rgba(48,54,61,0.4)]">
      <span className="text-[#e6edf3] text-sm truncate flex-1">{item.product_name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <PriceTagBadge status={item.price_status} />
        <span className="text-[#8b949e] text-xs font-mono">{formatCurrency(item.unit_price)}</span>
        <span className="text-[#58a6ff] text-xs font-bold w-10 text-right">×{item.quantity}</span>
      </div>
    </div>
  )
}
