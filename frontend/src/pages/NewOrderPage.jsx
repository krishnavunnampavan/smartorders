import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Camera, PenLine, Trash2, ChevronRight } from 'lucide-react'
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

export default function NewOrderPage() {
  const [tab, setTab] = useState('voice')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const { resolvedItems, removeResolvedItem, updateResolvedQty, clearResolvedItems } = useOrderStore()

  const total = resolvedItems.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0)

  const handleReviewOrder = async () => {
    if (!resolvedItems.length) {
      toast.error('Add at least one item first')
      return
    }
    setCreating(true)
    try {
      const month = thisMonth()
      const { data: order } = await client.post('/orders', { order_month: month })
      // Add all items
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
      navigate(`/orders?review=${order.id}`)
    } catch {
      // handled
    } finally {
      setCreating(false)
    }
  }

  return (
    <Layout title="New Order">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-5 gap-6">
          {/* Input panel */}
          <div className="col-span-3 glass-card p-5">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[#0d1117]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === id
                      ? 'bg-[#58a6ff]/20 text-[#58a6ff]'
                      : 'text-[#8b949e] hover:text-[#e6edf3]'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>

            {tab === 'voice' && <VoiceInput />}
            {tab === 'photo' && <PhotoInput />}
            {tab === 'manual' && <ManualEntry />}
          </div>

          {/* Order list */}
          <div className="col-span-2 glass-card p-5 flex flex-col">
            <h2 className="text-[#e6edf3] font-semibold mb-4">
              Order List
              <span className="ml-2 text-[#8b949e] text-sm font-normal">
                ({resolvedItems.length} items)
              </span>
            </h2>

            {resolvedItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[#8b949e] text-sm text-center">
                Use Voice, Photo, or Manual<br />to add items
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto min-h-0 mb-4">
                {resolvedItems.map((item) => (
                  <div key={item.product_id} className="p-3 rounded-lg bg-[rgba(22,27,34,0.6)] border border-[rgba(48,54,61,0.5)]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[#e6edf3] text-sm font-medium flex-1 leading-tight">
                        {item.product_name}
                      </p>
                      <button
                        onClick={() => removeResolvedItem(item.product_id)}
                        className="text-[#8b949e] hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {item.price_status && (
                        <PriceTagBadge status={item.price_status} />
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-gray-600"
                          onClick={() => updateResolvedQty(item.product_id, Math.max(1, item.quantity - 1))}
                        >−</button>
                        <span className="text-[#e6edf3] text-sm font-mono w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-gray-600"
                          onClick={() => updateResolvedQty(item.product_id, item.quantity + 1)}
                        >+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resolvedItems.length > 0 && (
              <div className="border-t border-[rgba(48,54,61,0.8)] pt-4">
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-[#8b949e]">Estimated Total</span>
                  <span className="text-[#e6edf3] font-medium">{formatCurrency(total)}</span>
                </div>
                <button
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  onClick={handleReviewOrder}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Review & Split Order'}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
