import { useState } from 'react'
import {
  ShoppingCart, X, Trash2, CheckCircle, ClipboardList,
  ChevronDown, StickyNote, Calendar, FileDown, TrendingDown,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useOrderStore } from '../../store/orderStore'
import PriceTagBadge from './PriceTagBadge'
import { formatCurrency } from '../../utils/formatters'
import client from '../../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────
function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = -1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      value: d.toISOString().slice(0, 10),
    })
  }
  return options
}

function todayFirstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function SelectBox({ value, options, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[rgba(48,54,61,0.5)] border border-[rgba(48,54,61,0.4)] text-[#e6edf3] text-[10px] rounded px-1.5 py-0.5 pr-4 focus:outline-none focus:border-[#58a6ff]/50 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
      <ChevronDown size={9} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
    </div>
  )
}

// ── Cart item row ─────────────────────────────────────────────────────────
function CartItem({ item }) {
  const { removeItem, updateItemQty, updateItemSize, updateItemUnit } = useOrderStore()

  const sizeLabels = item.size_options?.length
    ? item.size_options.map((s) => s.size_label)
    : ['50ml', '100ml', '200ml', '375ml', '500ml', '750ml', '1L', '1.75L']

  const unitLabels = item.unit_options?.length
    ? item.unit_options.map((u) => u.unit_label)
    : ['Bottle', 'Half Case', 'Case', 'Mixed Case']

  const lineTotal = item.unit_price != null ? item.unit_price * item.quantity : null
  const dealSavings = item.price_status === 'DEAL' && item.price_change
    ? Math.abs(item.price_change) * item.quantity * (item.bottles_per_unit || 1)
    : 0

  return (
    <div className="p-3 rounded-xl bg-[#0d1117] border border-[rgba(48,54,61,0.6)] space-y-2">
      {/* Name + remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[#e6edf3] text-sm font-medium leading-snug truncate">{item.product_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.price_status && <PriceTagBadge status={item.price_status} />}
            {dealSavings > 0 && (
              <span className="text-green-400 text-[10px] flex items-center gap-0.5">
                <TrendingDown size={10} />saving ${dealSavings.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => removeItem(item._key)}
          className="text-[#8b949e] hover:text-red-400 p-1 shrink-0 -mt-0.5 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Size + Unit selectors */}
      <div className="flex items-center gap-2 flex-wrap">
        <SelectBox
          value={item.selected_size || '750ml'}
          options={sizeLabels}
          onChange={(v) => updateItemSize(item._key, v)}
        />
        <SelectBox
          value={item.selected_unit || 'Case'}
          options={unitLabels}
          onChange={(v) => updateItemUnit(item._key, v)}
        />
        <span className="text-[#484f58] text-[10px] ml-auto">
          {(item.bottles_per_unit || 1)} btl/unit
        </span>
      </div>

      {/* Qty controls + totals */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)] transition-colors"
            onClick={() => updateItemQty(item._key, Math.max(1, item.quantity - 1))}
          >−</button>
          <span className="text-[#e6edf3] text-sm font-mono w-6 text-center select-none">{item.quantity}</span>
          <button
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)] transition-colors"
            onClick={() => updateItemQty(item._key, item.quantity + 1)}
          >+</button>
        </div>
        <div className="ml-auto text-right">
          {lineTotal != null && (
            <p className="text-[#e6edf3] text-xs font-semibold">{formatCurrency(lineTotal)}</p>
          )}
          <p className="text-[#484f58] text-[10px]">{(item.total_bottles || item.quantity * (item.bottles_per_unit || 1))} bottles total</p>
        </div>
      </div>
    </div>
  )
}

// ── Confirm sheet ─────────────────────────────────────────────────────────
function ConfirmSheet({ items, total, totalBottles, dealSavings, onCancel, onConfirm, submitting, createdOrderId }) {
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
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0d1117] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#e6edf3]">{items.length}</p>
            <p className="text-[#8b949e] text-[10px] mt-0.5">Items</p>
          </div>
          <div className="bg-[#0d1117] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#58a6ff]">{formatCurrency(total)}</p>
            <p className="text-[#8b949e] text-[10px] mt-0.5">Est. Total</p>
          </div>
          <div className="bg-[#0d1117] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#e6edf3]">{totalBottles.toLocaleString()}</p>
            <p className="text-[#8b949e] text-[10px] mt-0.5">Bottles</p>
          </div>
        </div>

        {dealSavings > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30 text-green-400 text-xs">
            <TrendingDown size={13} />
            Saving {formatCurrency(dealSavings)} on DEAL items this month
          </div>
        )}

        {/* Item preview */}
        <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg bg-[#0d1117] p-2">
          {items.map((item) => (
            <div key={item._key} className="flex justify-between items-center text-xs px-2 py-1">
              <span className="text-[#e6edf3] truncate flex-1 mr-2">{item.product_name}</span>
              <span className="text-[#8b949e] shrink-0 text-[10px]">
                {item.selected_size} · {item.selected_unit} ×{item.quantity}
              </span>
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
              {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            rows={2}
            placeholder="E.g. 'Holiday stock-up'…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* PDF buttons (shown after order is created) */}
        {createdOrderId && (
          <div className="space-y-2 pt-1">
            <p className="text-[#8b949e] text-xs font-medium">Download PDFs</p>
            <button
              onClick={() => window.open(`/api/orders/${createdOrderId}/pdf/master`, '_blank')}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
            >
              <FileDown size={14} /> Master PDF (all distributors)
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[rgba(48,54,61,0.8)] shrink-0 space-y-2">
        {!createdOrderId ? (
          <button
            onClick={() => onConfirm(orderMonth, notes)}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-60 transition-colors"
          >
            <CheckCircle size={17} />
            {submitting ? 'Creating Order…' : 'Create & Generate PDFs'}
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-[#e6edf3] bg-[rgba(48,54,61,0.6)] hover:bg-[rgba(48,54,61,0.9)] transition-colors"
          >
            Done
          </button>
        )}
        {!createdOrderId && (
          <button onClick={onCancel} className="w-full py-2 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            Back to cart
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function FloatingOrderCart() {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { items, clearItems, clearResolvedItems } = useOrderStore()

  if (location.pathname.startsWith('/order/')) return null

  const count = items.length
  const total = items.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0)
  const totalBottles = items.reduce((s, i) => s + (i.total_bottles || i.quantity * (i.bottles_per_unit || 1)), 0)
  const dealSavings = items.reduce((s, i) => {
    if (i.price_status === 'DEAL' && i.price_change) {
      return s + Math.abs(i.price_change) * i.quantity * (i.bottles_per_unit || 1)
    }
    return s
  }, 0)
  const dealCount = items.filter((i) => i.price_status === 'DEAL').length

  const handleConfirm = async (orderMonth, notes) => {
    setSubmitting(true)
    try {
      const { data: order } = await client.post('/orders', {
        order_month: orderMonth,
        notes: notes || null,
      })

      await Promise.all(
        items.map((item) =>
          client.post(`/orders/${order.id}/items`, {
            product_id: item.product_id,
            company_id: item.company_id,
            quantity: item.quantity,
            source: item.source || 'manual',
            selected_size: item.selected_size || '750ml',
            selected_unit: item.selected_unit || 'Case',
            bottles_per_unit: item.bottles_per_unit || 1,
          })
        )
      )
      await client.post(`/orders/${order.id}/split`)

      setCreatedOrderId(order.id)
      clearItems()
      clearResolvedItems()
      navigate(`/orders?review=${order.id}`)
      toast.success('Order created!')

      // Auto-open master PDF
      window.open(`/api/orders/${order.id}/pdf/master`, '_blank')
    } catch {
      toast.error('Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => { setOpen(false); setConfirming(false); setCreatedOrderId(null) }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`
          fixed z-50 flex flex-col
          bg-[#161b22] border-[rgba(48,54,61,0.8)]
          shadow-2xl transition-transform duration-300 ease-out
          bottom-0 left-0 right-0 rounded-t-2xl border-t
          lg:top-0 lg:bottom-0 lg:left-auto lg:right-0 lg:w-[22rem] lg:rounded-none lg:border-l lg:border-t-0
          ${open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'}
          max-h-[90vh] lg:max-h-screen lg:h-screen
        `}
      >
        {/* Mobile handle */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[rgba(48,54,61,0.8)]" />
        </div>

        {confirming ? (
          <ConfirmSheet
            items={items}
            total={total}
            totalBottles={totalBottles}
            dealSavings={dealSavings}
            onCancel={handleClose}
            onConfirm={handleConfirm}
            submitting={submitting}
            createdOrderId={createdOrderId}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(48,54,61,0.8)] shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-[#58a6ff]" />
                <span className="text-[#e6edf3] font-semibold text-sm">
                  Order Cart
                  {count > 0 && (
                    <span className="ml-2 text-xs font-normal text-[#8b949e]">{count} item{count !== 1 ? 's' : ''}</span>
                  )}
                </span>
              </div>
              <button onClick={handleClose} className="text-[#8b949e] hover:text-[#e6edf3] p-1 rounded-md hover:bg-[rgba(48,54,61,0.5)] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Stats bar */}
            {count > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(48,54,61,0.4)] bg-[rgba(13,17,23,0.5)] shrink-0">
                <div className="text-center">
                  <p className="text-[#e6edf3] text-xs font-semibold">{formatCurrency(total)}</p>
                  <p className="text-[#484f58] text-[9px]">est. total</p>
                </div>
                <div className="w-px h-6 bg-[rgba(48,54,61,0.6)]" />
                <div className="text-center">
                  <p className="text-[#e6edf3] text-xs font-semibold">{totalBottles.toLocaleString()}</p>
                  <p className="text-[#484f58] text-[9px]">bottles</p>
                </div>
                {dealCount > 0 && (
                  <>
                    <div className="w-px h-6 bg-[rgba(48,54,61,0.6)]" />
                    <div className="text-center">
                      <p className="text-green-400 text-xs font-semibold">-{formatCurrency(dealSavings)}</p>
                      <p className="text-[#484f58] text-[9px]">savings</p>
                    </div>
                  </>
                )}
              </div>
            )}

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
                items.map((item) => <CartItem key={item._key} item={item} />)
              )}
            </div>

            {/* Footer */}
            {count > 0 && (
              <div className="p-4 border-t border-[rgba(48,54,61,0.8)] shrink-0 space-y-2">
                <button
                  onClick={() => setConfirming(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-500 active:bg-green-700 transition-colors"
                >
                  <CheckCircle size={17} />
                  Place Order
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setOpen((v) => !v); setConfirming(false) }}
        aria-label="View order cart"
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
