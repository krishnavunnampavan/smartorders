import { useState } from 'react'
import { ShoppingCart, X, Trash2, CheckCircle, ClipboardList, ChevronDown, StickyNote, Calendar } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useOrderStore } from '../../store/orderStore'
import PriceTagBadge from './PriceTagBadge'
import { formatCurrency } from '../../utils/formatters'
import client from '../../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────
function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = -1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const value = d.toISOString().slice(0, 10)
    options.push({ label, value })
  }
  return options
}

function todayFirstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

// ── Cart item row ─────────────────────────────────────────────────────────
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

// ── Confirmation sheet (slides up over the item list) ─────────────────────
function ConfirmSheet({ resolvedItems, total, onCancel, onConfirm, submitting }) {
  const monthOptions = getMonthOptions()
  const [orderMonth, setOrderMonth] = useState(todayFirstOfMonth())
  const [notes, setNotes] = useState('')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(48,54,61,0.8)] shrink-0">
        <span className="text-[#e6edf3] font-semibold text-sm">Confirm Order</span>
        <button onClick={onCancel} className="text-[#8b949e] hover:text-[#e6edf3] p-1 rounded-md hover:bg-[rgba(48,54,61,0.5)] transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0d1117] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#e6edf3]">{resolvedItems.length}</p>
            <p className="text-[#8b949e] text-xs mt-0.5">Items</p>
          </div>
          <div className="bg-[#0d1117] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-[#58a6ff]">{formatCurrency(total)}</p>
            <p className="text-[#8b949e] text-xs mt-0.5">Est. Total</p>
          </div>
        </div>

        {/* Item list preview */}
        <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg bg-[#0d1117] p-2">
          {resolvedItems.map((item) => (
            <div key={item.product_id} className="flex justify-between items-center text-xs px-2 py-1">
              <span className="text-[#e6edf3] truncate flex-1 mr-2">{item.product_name}</span>
              <span className="text-[#8b949e] shrink-0">×{item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Order month */}
        <div>
          <label className="flex items-center gap-1.5 text-[#8b949e] text-xs mb-1.5">
            <Calendar size={12} /> Order Month
          </label>
          <div className="relative">
            <select
              className="w-full bg-[#0d1117] border border-[rgba(48,54,61,0.6)] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]/50 appearance-none pr-8"
              value={orderMonth}
              onChange={(e) => setOrderMonth(e.target.value)}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="flex items-center gap-1.5 text-[#8b949e] text-xs mb-1.5">
            <StickyNote size={12} /> Notes (optional)
          </label>
          <textarea
            className="w-full bg-[#0d1117] border border-[rgba(48,54,61,0.6)] rounded-lg px-3 py-2 text-sm text-[#e6edf3] resize-none focus:outline-none focus:border-[#58a6ff]/50"
            rows={3}
            placeholder="E.g. 'Holiday stock-up', 'Extra Tito's for weekend'…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4 border-t border-[rgba(48,54,61,0.8)] shrink-0 space-y-2">
        <button
          onClick={() => onConfirm(orderMonth, notes)}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-60 transition-colors"
        >
          <CheckCircle size={17} />
          {submitting ? 'Creating Order…' : 'Create & Generate PDF'}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          Back to cart
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function FloatingOrderCart() {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedItems, clearResolvedItems } = useOrderStore()

  if (location.pathname.startsWith('/order/')) return null

  const count = resolvedItems.length
  const total = resolvedItems.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0)

  const handleConfirm = async (orderMonth, notes) => {
    setSubmitting(true)
    try {
      const { data: order } = await client.post('/orders', { order_month: orderMonth, notes: notes || null })
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
      await client.post(`/orders/${order.id}/split`)
      window.open(`/api/orders/${order.id}/combined-pdf`, '_blank')
      clearResolvedItems()
      setOpen(false)
      setConfirming(false)
      navigate(`/orders?review=${order.id}`)
      toast.success('Order created! PDF opened in new tab.')
    } catch {
      toast.error('Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => { setOpen(false); setConfirming(false) }}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`
          fixed z-50 flex flex-col
          bg-[#161b22] border-[rgba(48,54,61,0.8)]
          shadow-2xl transition-transform duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl border-t
          lg:top-0 lg:bottom-0 lg:left-auto lg:right-0 lg:w-80 lg:rounded-none lg:border-l lg:border-t-0
          ${open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'}
          max-h-[85vh] lg:max-h-screen lg:h-screen
        `}
      >
        {/* Handle bar (mobile only) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[rgba(48,54,61,0.8)]" />
        </div>

        {confirming ? (
          <ConfirmSheet
            resolvedItems={resolvedItems}
            total={total}
            onCancel={() => setConfirming(false)}
            onConfirm={handleConfirm}
            submitting={submitting}
          />
        ) : (
          <>
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

            {/* Footer */}
            {count > 0 && (
              <div className="p-4 border-t border-[rgba(48,54,61,0.8)] shrink-0 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#8b949e] text-sm">Est. Total</span>
                  <span className="text-[#e6edf3] font-semibold">{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={() => setConfirming(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-500 active:bg-green-700 transition-colors"
                >
                  <CheckCircle size={17} />
                  Order Finished
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setOpen((v) => !v); setConfirming(false) }}
        aria-label="View order list"
        className={`
          fixed z-50 bottom-[4.5rem] right-4
          lg:bottom-6 lg:right-6
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transition-all duration-200
          ${open ? 'scale-90 ring-2 ring-[#58a6ff]/50' : 'hover:scale-105'}
          ${count > 0 ? 'bg-green-600 hover:bg-green-500' : 'bg-[#21262d] hover:bg-[#30363d] border border-[rgba(48,54,61,0.8)]'}
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
