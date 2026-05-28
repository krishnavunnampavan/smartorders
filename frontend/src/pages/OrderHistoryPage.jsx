import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  CheckCircle, Clock, FileText, RotateCcw, StickyNote,
  ChevronRight, ShoppingCart, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'
import { useOrderStore } from '../store/orderStore'

function StatusBadge({ status }) {
  if (status === 'confirmed') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
        <CheckCircle size={10} /> Confirmed
      </span>
    )
  }
  if (status === 'sent') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400">
        <Clock size={10} /> Sent
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
      Draft
    </span>
  )
}

function ReorderButton({ orderId }) {
  const { addResolvedItem } = useOrderStore()
  const [loading, setLoading] = useState(false)

  const handleReorder = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const { data: items } = await client.get(`/orders/${orderId}/items`)
      if (!items?.length) { toast.error('No items in this order'); return }
      items.forEach((item) =>
        addResolvedItem({
          product_id: item.product_id,
          product_name: item.product_name,
          company_id: item.company_id,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          price_status: item.price_status,
          source: 'reorder',
        })
      )
      toast.success(`${items.length} items added to cart`)
    } catch {
      toast.error('Failed to load order items')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading}
      title="Re-add all items to cart"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.8)] transition-colors disabled:opacity-50 border border-[rgba(48,54,61,0.8)]"
    >
      <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Loading…' : 'Reorder'}
    </button>
  )
}

export default function OrderHistoryPage() {
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => client.get('/orders').then((r) => r.data),
  })

  const filtered = orders?.filter((o) => {
    if (statusFilter === 'draft') return o.status === 'draft'
    if (statusFilter === 'sent') return o.status === 'sent'
    if (statusFilter === 'confirmed') return o.status === 'confirmed'
    return true
  }) ?? []

  return (
    <Layout title="My Orders">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#e6edf3]">My Orders</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">Click any order to view items and manage them</p>
        </div>
        <Link
          to="/orders/new"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25 transition-colors font-medium"
        >
          <Plus size={15} /> New Order
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all', label: 'All Orders' },
          { key: 'draft', label: 'Drafts' },
          { key: 'sent', label: 'Sent' },
          { key: 'confirmed', label: 'Confirmed' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === key
                ? 'bg-[#58a6ff]/20 text-[#58a6ff] font-medium'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.5)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}

      <div className="space-y-3">
        {filtered.map((order) => {
          const month = order.order_month
            ? new Date(order.order_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : '—'

          return (
            <div key={order.id} className="glass-card overflow-hidden hover:border-[rgba(88,166,255,0.2)] transition-colors">
              <div className="flex items-center justify-between p-4 sm:p-5">
                {/* Left: Order info */}
                <Link to={`/orders/${order.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[#e6edf3] font-semibold group-hover:text-[#58a6ff] transition-colors">{month}</p>
                    <StatusBadge status={order.status} />
                    {order.notes && (
                      <span title={order.notes}>
                        <StickyNote size={13} className="text-[#58a6ff] opacity-70" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <p className="text-[#8b949e] text-sm">
                      {order.total_items ?? '?'} items
                    </p>
                    <p className="text-[#e6edf3] text-sm font-medium">
                      {formatCurrency(order.total_value)}
                    </p>
                    {order.deal_items_count > 0 && (
                      <p className="text-green-400 text-xs">
                        {order.deal_items_count} deals
                      </p>
                    )}
                    {order.savings_vs_last_month && (
                      <p className="text-green-400 text-xs">
                        saved {formatCurrency(order.savings_vs_last_month)}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <ReorderButton orderId={order.id} />
                  <Link
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
                  >
                    Open <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <ShoppingCart size={40} className="text-[#8b949e] mx-auto mb-4 opacity-50" />
          <p className="text-[#8b949e] text-sm">
            {statusFilter !== 'all'
              ? `No ${statusFilter} orders found.`
              : 'No orders yet. Create your first order to get started.'}
          </p>
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-2 mt-4 text-sm px-4 py-2 rounded-lg bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25 transition-colors"
          >
            <Plus size={14} /> Create Order
          </Link>
        </div>
      )}
    </Layout>
  )
}
