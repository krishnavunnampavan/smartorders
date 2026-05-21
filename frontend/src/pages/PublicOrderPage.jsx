import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'

export default function PublicOrderPage() {
  const { token } = useParams()
  const [confirmed, setConfirmed] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-order', token],
    queryFn: () => client.get(`/share/view/${token}`).then((r) => r.data),
  })

  const confirmMutation = useMutation({
    mutationFn: () => client.post(`/share/confirm/${token}`),
    onSuccess: () => { setConfirmed(true); toast.success('Order confirmed!') },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <LoadingSpinner size={36} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <p className="text-red-400 text-lg font-semibold mb-2">Link Not Found</p>
          <p className="text-[#8b949e] text-sm">
            This order link has expired or been revoked. Contact the store manager for a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-[#58a6ff] mb-1">🍾 LiquorStore Pro</div>
          <p className="text-[#8b949e] text-sm">Purchase Order</p>
        </div>

        <div className="glass-card p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-[#e6edf3] text-xl font-bold">{data?.company_name}</h1>
              <p className="text-[#8b949e] text-sm mt-1">Order Month: {data?.order_month}</p>
            </div>
            <div className="text-right">
              <p className="text-[#8b949e] text-xs">Items</p>
              <p className="text-[#e6edf3] font-semibold">{data?.item_count}</p>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(48,54,61,0.8)] text-[#8b949e] text-xs">
                  <th className="text-left pb-3 font-medium">Product</th>
                  <th className="text-left pb-3 font-medium">SKU</th>
                  <th className="text-left pb-3 font-medium">Size</th>
                  <th className="text-center pb-3 font-medium">Cases</th>
                  <th className="text-right pb-3 font-medium">Unit Price</th>
                  <th className="text-right pb-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((item, i) => (
                  <tr key={i} className="border-b border-[rgba(48,54,61,0.4)]">
                    <td className="py-3 text-[#e6edf3] font-medium">{item.product_name}</td>
                    <td className="py-3 text-[#8b949e]">{item.sku || '—'}</td>
                    <td className="py-3 text-[#8b949e]">{item.unit_size || '—'}</td>
                    <td className="py-3 text-center text-[#e6edf3]">{item.quantity}</td>
                    <td className="py-3 text-right text-[#e6edf3]">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-right text-[#e6edf3] font-medium">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand total */}
          <div className="flex justify-end mt-6 pt-4 border-t border-[rgba(48,54,61,0.8)]">
            <div className="text-right">
              <p className="text-[#8b949e] text-xs">Grand Total</p>
              <p className="text-[#e6edf3] text-2xl font-bold">{formatCurrency(data?.subtotal)}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <a
            href={`/api/share/pdf/${token}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} /> Download PDF
          </a>
          {!confirmed && data?.status !== 'confirmed' ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
            >
              <CheckCircle size={16} />
              {confirmMutation.isPending ? 'Confirming…' : 'Confirm Receipt'}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle size={16} /> Order Confirmed
            </div>
          )}
        </div>

        <p className="text-center text-[#8b949e] text-xs mt-8">
          Powered by LiquorStore Pro
        </p>
      </div>
    </div>
  )
}
