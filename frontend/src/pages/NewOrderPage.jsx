import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Camera, PenLine, Trash2, ChevronRight, Scan } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import VoiceInput from '../components/orders/VoiceInput'
import PhotoInput from '../components/orders/PhotoInput'
import ManualEntry from '../components/orders/ManualEntry'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import { useOrderStore } from '../store/orderStore'
import { formatCurrency, thisMonth } from '../utils/formatters'
import client from '../api/client'

const TABS = [
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'photo', label: 'Photo', icon: Camera },
  { id: 'manual', label: 'Manual', icon: PenLine },
]

function OrderItemRow({ item }) {
  const { removeResolvedItem, updateResolvedQty } = useOrderStore()
  return (
    <div className="p-3 rounded-lg bg-[rgba(22,27,34,0.6)] border border-[rgba(48,54,61,0.5)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[#e6edf3] text-sm font-medium flex-1 leading-tight">{item.product_name}</p>
        <button onClick={() => removeResolvedItem(item.product_id)} className="text-[#8b949e] hover:text-red-400 shrink-0 p-1">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {item.price_status && <PriceTagBadge status={item.price_status} />}
        <div className="flex items-center gap-1 ml-auto">
          <button className="w-7 h-7 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center"
            onClick={() => updateResolvedQty(item.product_id, Math.max(1, item.quantity - 1))}>−</button>
          <span className="text-[#e6edf3] text-sm font-mono w-6 text-center">{item.quantity}</span>
          <button className="w-7 h-7 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center"
            onClick={() => updateResolvedQty(item.product_id, item.quantity + 1)}>+</button>
        </div>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  const [tab, setTab] = useState('voice')
  const [creating, setCreating] = useState(false)
  const [showList, setShowList] = useState(false)
  const navigate = useNavigate()
  const { resolvedItems, clearResolvedItems } = useOrderStore()
  const total = resolvedItems.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0)

  const handleReviewOrder = async () => {
    if (!resolvedItems.length) { toast.error('Add at least one item first'); return }
    setCreating(true)
    try {
      const { data: order } = await client.post('/orders', { order_month: thisMonth() })
      await Promise.all(resolvedItems.map((item) =>
        client.post(`/orders/${order.id}/items`, {
          product_id: item.product_id,
          company_id: item.company_id,
          quantity: item.quantity,
          source: item.source || 'manual',
        })
      ))
      clearResolvedItems()
      navigate(`/orders?review=${order.id}`)
    } catch { /* handled by axios interceptor */ }
    finally { setCreating(false) }
  }

  return (
    <Layout title="New Order">
      {/* Mobile: tab switcher full-width; Desktop: side-by-side */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-3 glass-card p-4 mb-4 lg:mb-0">
          {/* Tab bar */}
          <div className="flex gap-1 mb-5 p-1 rounded-lg bg-[#0d1117]">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === id ? 'bg-[#58a6ff]/20 text-[#58a6ff]' : 'text-[#8b949e]'
                }`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {tab === 'voice' && <VoiceInput />}
          {tab === 'photo' && <PhotoInput />}
          {tab === 'manual' && <ManualEntry />}
        </div>

        {/* Order List — always visible on desktop, toggled on mobile */}
        <div className="lg:col-span-2">
          {/* Mobile toggle */}
          {resolvedItems.length > 0 && (
            <button
              className="w-full lg:hidden flex items-center justify-between p-4 glass-card mb-3"
              onClick={() => setShowList(!showList)}
            >
              <span className="text-[#e6edf3] font-medium">
                Order List ({resolvedItems.length} items)
              </span>
              <span className="text-[#58a6ff] text-sm">{showList ? 'Hide' : 'Show'}</span>
            </button>
          )}

          <div className={`glass-card p-4 flex flex-col ${!showList && resolvedItems.length > 0 ? 'hidden lg:flex' : 'flex'}`}>
            <h2 className="text-[#e6edf3] font-semibold mb-3 hidden lg:block">
              Order List <span className="text-[#8b949e] text-sm font-normal">({resolvedItems.length})</span>
            </h2>

            {resolvedItems.length === 0 ? (
              <div className="py-10 text-center text-[#8b949e] text-sm">
                Use Voice, Photo, or Manual<br />to add items here
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[50vh] lg:max-h-[60vh] mb-4">
                {resolvedItems.map((item) => <OrderItemRow key={item.product_id} item={item} />)}
              </div>
            )}

            {resolvedItems.length > 0 && (
              <div className="border-t border-[rgba(48,54,61,0.8)] pt-4 mt-auto">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-[#8b949e]">Est. Total</span>
                  <span className="text-[#e6edf3] font-medium">{formatCurrency(total)}</span>
                </div>
                <button className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  onClick={handleReviewOrder} disabled={creating}>
                  {creating ? 'Creating…' : 'Review & Split Order'}
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar when items exist */}
      {resolvedItems.length > 0 && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 px-4 pb-2 z-40">
          <button className="btn-primary w-full flex items-center justify-center gap-2 shadow-2xl"
            onClick={handleReviewOrder} disabled={creating}>
            {creating ? 'Creating…' : `Review ${resolvedItems.length} items — ${formatCurrency(total)}`}
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </Layout>
  )
}
