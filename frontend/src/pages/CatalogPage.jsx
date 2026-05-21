import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, TrendingDown, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency, thisMonth } from '../utils/formatters'

function UploadZone({ companies, onUploadDone }) {
  const [companyId, setCompanyId] = useState('')
  const [month, setMonth] = useState(thisMonth().slice(0, 7))
  const [uploading, setUploading] = useState(false)

  const onDrop = async (files) => {
    const file = files[0]
    if (!file || !companyId) {
      toast.error('Select a company first')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('company_id', companyId)
      form.append('upload_month', month + '-01')
      form.append('file', file)
      const { data } = await client.post('/catalog/upload', form)
      toast.success(`Parsed ${data.items_parsed} items, matched ${data.items_matched}`)
      onUploadDone(companyId, month + '-01')
    } catch {
      // handled
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': [],
      'image/*': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/vnd.ms-excel': [],
      'text/csv': [],
    },
    maxFiles: 1,
  })

  return (
    <div className="glass-card p-5 mb-6">
      <h2 className="text-[#e6edf3] font-semibold mb-4">Upload Catalog</h2>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-[#8b949e] text-xs mb-1">Company</label>
          <select
            className="input-field"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Select distributor…</option>
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[#8b949e] text-xs mb-1">Month</label>
          <input
            type="month"
            className="input-field"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-accent-blue bg-blue-500/10' :
          'border-[rgba(48,54,61,0.8)] hover:border-[#58a6ff]/50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex items-center justify-center gap-3">
            <LoadingSpinner size={20} />
            <span className="text-[#8b949e] text-sm">Uploading and parsing with AI…</span>
          </div>
        ) : (
          <>
            <Upload size={28} className="mx-auto mb-2 text-[#8b949e]" />
            <p className="text-[#e6edf3] text-sm">
              {isDragActive ? 'Drop catalog here' : 'Drag & drop catalog (PDF, Excel, Image) or click to browse'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function PriceCompareTable({ companyId, month }) {
  const { data, isLoading } = useQuery({
    queryKey: ['price-compare', companyId, month],
    queryFn: () =>
      client.get(`/catalog/price-compare/${companyId}?month=${month}`).then((r) => r.data),
    enabled: !!companyId && !!month,
  })

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!data) return null

  const allItems = [
    ...(data.deals || []).map((d) => ({ ...d, _group: 'deal' })),
    ...(data.holds || []).map((h) => ({ ...h, _group: 'hold' })),
    ...(data.stable || []).map((s) => ({ ...s, _group: 'stable' })),
  ]

  return (
    <div className="glass-card p-5">
      {/* Summary row */}
      <div className="flex gap-6 mb-5 text-sm">
        <span className="text-green-400 font-semibold">
          {data.deals?.length} deals
        </span>
        <span className="text-red-400 font-semibold">
          {data.holds?.length} holds
        </span>
        <span className="text-[#8b949e]">
          {data.stable?.length} stable
        </span>
        <span className="text-[#e6edf3] ml-auto">
          Savings potential: <strong>{formatCurrency(data.savings_potential)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(48,54,61,0.8)] text-[#8b949e] text-xs">
              <th className="text-left pb-2 font-medium">Product</th>
              <th className="text-left pb-2 font-medium">SKU</th>
              <th className="text-right pb-2 font-medium">Last Month</th>
              <th className="text-right pb-2 font-medium">This Month</th>
              <th className="text-right pb-2 font-medium">Change</th>
              <th className="text-center pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-[rgba(48,54,61,0.3)] ${
                  item._group === 'deal' ? 'bg-green-500/5' :
                  item._group === 'hold' ? 'bg-red-500/5' : ''
                }`}
              >
                <td className="py-2.5 text-[#e6edf3]">{item.product_name}</td>
                <td className="py-2.5 text-[#8b949e]">{item.sku || '—'}</td>
                <td className="py-2.5 text-right text-[#8b949e] font-mono">
                  ${(item.prev_price || 0).toFixed(2)}
                </td>
                <td className="py-2.5 text-right text-[#e6edf3] font-mono">
                  ${(item.new_price || 0).toFixed(2)}
                </td>
                <td className={`py-2.5 text-right font-mono text-sm ${
                  item.change < 0 ? 'text-green-400' :
                  item.change > 0 ? 'text-red-400' : 'text-[#8b949e]'
                }`}>
                  {item.change > 0 ? '+' : ''}${(item.change || 0).toFixed(2)}
                  <span className="text-xs ml-1">
                    ({item.change_pct > 0 ? '+' : ''}{(item.change_pct || 0).toFixed(1)}%)
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <PriceTagBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!allItems.length && (
        <p className="text-[#8b949e] text-sm text-center py-8">
          No price data for this month. Upload a catalog to see comparisons.
        </p>
      )}
    </div>
  )
}

export default function CatalogPage() {
  const [viewCompanyId, setViewCompanyId] = useState('')
  const [viewMonth, setViewMonth] = useState(thisMonth())

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const handleUploadDone = (companyId, month) => {
    setViewCompanyId(companyId)
    setViewMonth(month)
  }

  return (
    <Layout title="Catalog & Price Intelligence">
      <UploadZone companies={companies} onUploadDone={handleUploadDone} />

      {/* Filter for price compare view */}
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-[#8b949e] text-xs mb-1">View Company</label>
          <select
            className="input-field"
            value={viewCompanyId}
            onChange={(e) => setViewCompanyId(e.target.value)}
          >
            <option value="">Select…</option>
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[#8b949e] text-xs mb-1">Month</label>
          <input
            type="date"
            className="input-field"
            value={viewMonth}
            onChange={(e) => setViewMonth(e.target.value)}
          />
        </div>
      </div>

      {viewCompanyId && <PriceCompareTable companyId={viewCompanyId} month={viewMonth} />}
    </Layout>
  )
}
