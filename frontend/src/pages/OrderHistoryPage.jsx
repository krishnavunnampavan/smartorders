import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Link2, Download, CheckCircle, Clock, RotateCcw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'
import { useOrderStore } from '../store/orderStore'

function SplitCard({ split, orderId }) {
  const [linkInfo, setLinkInfo] = useState(null)

  const generateLink = async () => {
    const { data } = await client.post(`/share/generate/${split.id}`)
    setLinkInfo(data)
    await navigator.clipboard.writeText(window.location.origin + data.link)
    toast.success('Link copied to clipboard!')
  }

  const downloadPdf = () => {
    window.open(`/api/share/pdf/${linkInfo?.token}`, '_blank')
  }

  const belowMin = split.company_min_order && split.subtotal < split.company_min_order

  return (
    <div className={`p-4 rounded-lg border bg-[rgba(22,27,34,0.4)] ${
      belowMin ? 'border-yellow-600/50' : 'border-[rgba(48,54,61,0.8)]'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#e6edf3] font-medium">{split.company_name || 'Company'}</p>
          <p className="text-[#8b949e] text-xs mt-0.5">
            {split.item_count} items · {formatCurrency(split.subtotal)}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          split.status === 'confirmed' ? 'bg-green-900/50 text-green-400' :
          split.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
          'bg-gray-700 text-gray-400'
        }`}>
          {split.status === 'confirmed' ? <CheckCircle size={10} className="inline mr-1" /> :
           split.status === 'sent' ? <Clock size={10} className="inline mr-1" /> : null}
          {split.status}
        </span>
      </div>

      {/* Min order warning */}
      {belowMin && (
        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-xs">
            Below minimum order of {formatCurrency(split.company_min_order)} —
            {' '}short by {formatCurrency(split.company_min_order - split.subtotal)}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button className="btn-secondary text-xs py-1.5 flex items-center gap-1.5" onClick={generateLink}>
          <Link2 size={13} /> Generate Link
        </button>
        {linkInfo && (
          <button className="btn-secondary text-xs py-1.5 flex items-center gap-1.5" onClick={downloadPdf}>
            <Download size={13} /> PDF
          </button>
        )}
      </div>
      {linkInfo && (
        <p className="text-xs text-[#58a6ff] mt-2 font-mono truncate">
          {window.location.origin}{linkInfo.link}
        </p>
      )}
    </div>
  )
}

function OrderDetail({ orderId }) {
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => client.get(`/orders/${orderId}`).then((r) => r.data),
  })
  const { data: items } = useQuery({
    queryKey: ['order-items', orderId],
    queryFn: () => client.get(`/orders/${orderId}/items`).then((r) => r.data),
  })
  const { data: rawSplits, refetch: refetchSplits } = useQuery({
    queryKey: ['order-splits', orderId],
    queryFn: () => client.get(`/orders/${orderId}/splits`).then((r) => r.data),
  })

  const splitMutation = useMutation({
    mutationFn: () => client.post(`/orders/${orderId}/split`),
    onSuccess: () => { refetchSplits(); toast.success('Order split by company') },
  })

  if (!order) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs">Total Items</p>
          <p className="text-2xl font-bold text-[#e6edf3]">{order.total_items ?? items?.length ?? 0}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs">Total Value</p>
          <p className="text-2xl font-bold text-[#e6edf3]">{formatCurrency(order.total_value)}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs">Deal Items</p>
          <p className="text-2xl font-bold text-green-400">{order.deal_items_count ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Items table */}
        <div className="glass-card p-4">
          <h3 className="text-[#e6edf3] font-semibold mb-3">Line Items</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded bg-[rgba(48,54,61,0.3)]">
                <span className="text-[#e6edf3] flex-1 truncate">{item.product_name || item.product_id?.slice(0, 8)}</span>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {item.price_status && <PriceTagBadge status={item.price_status} />}
                  <span className="text-[#8b949e] text-xs">×{item.quantity}</span>
                  <span className="text-[#e6edf3] font-mono text-xs">{formatCurrency(item.line_total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Company splits */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#e6edf3] font-semibold">Company Splits</h3>
            <button className="btn-secondary text-xs py-1.5" onClick={() => splitMutation.mutate()}>
              {splitMutation.isPending ? 'Splitting…' : 'Split by Company'}
            </button>
          </div>
          <div className="space-y-3">
            {rawSplits?.map((split) => (
              <SplitCard key={split.id} split={split} orderId={orderId} />
            ))}
            {!rawSplits?.length && (
              <p className="text-[#8b949e] text-sm">
                Click "Split by Company" to group items and generate links.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReorderButton({ orderId }) {
  const { addResolvedItem } = useOrderStore()
  const [loading, setLoading] = useState(false)

  const handleReorder = async (e) => {
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
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors disabled:opacity-50 shrink-0"
    >
      <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Loading…' : 'Reorder'}
    </button>
  )
}

export default function OrderHistoryPage() {
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('review')
  const [expandedId, setExpandedId] = useState(reviewId || null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => client.get('/orders').then((r) => r.data),
  })

  return (
    <Layout title="Order History">
      <div className="space-y-4">
        {isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}
        {orders?.map((order) => (
          <div key={order.id} className="glass-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left"
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[#e6edf3] font-medium">{order.order_month}</p>
                <p className="text-[#8b949e] text-xs mt-0.5">
                  {order.total_items ?? '?'} items · {formatCurrency(order.total_value)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <ReorderButton orderId={order.id} />
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  order.status === 'draft' ? 'bg-gray-700 text-gray-300' :
                  order.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
                  'bg-green-900/50 text-green-400'
                }`}>
                  {order.status}
                </span>
              </div>
            </button>
            {expandedId === order.id && (
              <div className="px-5 pb-5 border-t border-[rgba(48,54,61,0.8)]">
                <div className="pt-5">
                  <OrderDetail orderId={order.id} />
                </div>
              </div>
            )}
          </div>
        ))}
        {!isLoading && !orders?.length && (
          <div className="glass-card p-12 text-center text-[#8b949e]">
            No orders yet. Create your first order to get started.
          </div>
        )}
      </div>
    </Layout>
  )
}
