import { useState } from 'react'
import { ShoppingCart, X, Trash2, CheckCircle, ClipboardList } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useOrderStore } from '../../store/orderStore'
import PriceTagBadge from './PriceTagBadge'
import { formatCurrency, thisMonth } from '../../utils/formatters'
import client from '../../api/client'

function CartItem({ item }) {
  const { removeResolvedItem, updateResolvedQty } = useOrderStore()
  return (
    <div className="p-3 rounded-xl bg-[#0d1117] border border-[rgba(48,54,61,0.6)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[#e6edf3] text-sm font-medium leading-snug flex-1">{item.product_name}</p>
        <button
          onClick={() => removeResolvedItem(item.product_id)}
          className="text-[#8b949e] hover:text-red-400 p-1 shrink-0 -mt-0.5 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {item.price_status && <PriceTagBadge status={item.price_status} />}
        {item.unit_price > 0 && (
          <span className="text-[#8b949e] text-xs">{formatCurrency(item.unit_price)}</span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)] transition-colors"
            onClick={() => updateResolvedQty(item.product_id, Math.max(1, item.quantity - 1))}
          >−</button>
          <span className="text-[#e6edf3] text-sm font-mono w-6 text-center select-none">{item.quantity}</span>
          <button
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)] transition-colors"
            onClick={() => updateResolvedQty(item.product_id, item.quantity + 1)}
          >+</button>
        </div>
      </div>
    </div>
  )
}

export default function FloatingOrderCart() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedItems, clearResolvedItems } = useOrderStore()

  // Hide on the public share-link page
  if (location.pathname.startsWith('/order/')) return null

  const count = resolvedItems.length
  const total = resolvedItems.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0)

  const handleFinish = async () => {
    if (!count) { toast.error('Add at least one item first'); return }
    setSubmitting(true)
    try {
      const { data: order } = await client.post('/orders', { order_month: thisMonth() })
      await Promise.all(
        resolvedItems.map((item) =>
          client.post(`/orders/${order.id}/items`, {
            product_id: item.product_id,
            company_id: item.company_id,
            quantity: item.quantity,
            source: item.source || 'manual',
          })
        )
      )
      clearResolvedItems()
      setOpen(false)
      navigate(`/orders?review=${order.id}`)
      toast.success('Order created!')
    } catch {
      toast.error('Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Dark overlay on mobile when open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel — right drawer on desktop, bottom sheet on mobile */}
      <div
        className={`
          fixed z-50 flex flex-col
          bg-[#161b22] border-[rgba(48,54,61,0.8)]
          shadow-2xl transition-transform duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl border-t
          lg:top-0 lg:bottom-0 lg:left-auto lg:right-0 lg:w-80 lg:rounded-none lg:border-l lg:border-t-0
          ${open
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
          }
          max-h-[85vh] lg:max-h-screen lg:h-screen
        `}
      >
        {/* Handle bar (mobile only) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[rgba(48,54,61,0.8)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(48,54,61,0.8)] shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-[#58a6ff]" />
            <span className="text-[#e6edf3] font-semibold text-sm">
              Current Order
              {count > 0 && (
                <span className="ml-2 text-xs font-normal text-[#8b949e]">{count} item{count !== 1 ? 's' : ''}</span>
              )}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[#8b949e] hover:text-[#e6edf3] p-1 rounded-md hover:bg-[rgba(48,54,61,0.5)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {count === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart size={36} className="mx-auto mb-3 text-[rgba(139,148,158,0.3)]" />
              <p className="text-[#8b949e] text-sm font-medium">No items yet</p>
              <p className="text-[#8b949e] text-xs mt-1 opacity-70">
                Add items via Voice, Photo,<br />or Manual entry
              </p>
            </div>
          ) : (
            resolvedItems.map((item) => (
              <CartItem key={item.product_id} item={item} />
            ))
          )}
        </div>

        {/* Footer — only when items exist */}
        {count > 0 && (
          <div className="p-4 border-t border-[rgba(48,54,61,0.8)] shrink-0 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#8b949e] text-sm">Est. Total</span>
              <span className="text-[#e6edf3] font-semibold">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle size={17} />
              {submitting ? 'Creating Order…' : 'Order Finished'}
            </button>
          </div>
        )}
      </div>

      {/* FAB — always visible, floats above bottom nav on mobile */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="View order list"
        className={`
          fixed z-50 bottom-[4.5rem] right-4
          lg:bottom-6 lg:right-6
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transition-all duration-200
          ${open ? 'scale-90 ring-2 ring-[#58a6ff]/50' : 'hover:scale-105'}
          ${count > 0
            ? 'bg-green-600 hover:bg-green-500'
            : 'bg-[#21262d] hover:bg-[#30363d] border border-[rgba(48,54,61,0.8)]'
          }
        `}
      >
        <ShoppingCart size={22} className="text-white" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full text-[11px] text-white flex items-center justify-center font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </>
  )
}
