import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
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
    if (!companyId) { toast.error('Select a company first'); return }
    const file = files[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('company_id', companyId)
      form.append('upload_month', month + '-01')
      form.append('file', file)
      const { data } = await client.post('/catalog/upload', form)
      toast.success(`Parsed ${data.items_parsed} items, matched ${data.items_matched}`)
      onUploadDone(companyId, month + '-01')
    } finally { setUploading(false) }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/*': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/vnd.ms-excel': [], 'text/csv': [] },
    maxFiles: 1,
  })

  return (
    <div className="glass-card p-4 mb-5">
      <h2 className="text-[#e6edf3] font-semibold mb-4">Upload Catalog</h2>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select className="input-field flex-1" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Select distributor…</option>
          {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" className="input-field sm:w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-[#58a6ff] bg-blue-500/10' : 'border-[rgba(48,54,61,0.8)] hover:border-[#58a6ff]/50'
      } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        <input {...getInputProps()} />
        {uploading
          ? <div className="flex items-center justify-center gap-3"><LoadingSpinner size={20} /><span className="text-[#8b949e] text-sm">Parsing with AI…</span></div>
          : <><Upload size={26} className="mx-auto mb-2 text-[#8b949e]" /><p className="text-[#e6edf3] text-sm">{isDragActive ? 'Drop it here' : 'PDF, Excel, or Image'}</p><p className="text-[#8b949e] text-xs mt-1">Tap to browse</p></>
        }
      </div>
    </div>
  )
}

function PriceCompareTable({ companyId, month }) {
  const { data, isLoading } = useQuery({
    queryKey: ['price-compare', companyId, month],
    queryFn: () => client.get(`/catalog/price-compare/${companyId}?month=${month}`).then((r) => r.data),
    enabled: !!companyId && !!month,
  })

  if (isLoading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>
  if (!data) return null

  const allItems = [
    ...(data.deals || []).map((d) => ({ ...d, _g: 'deal' })),
    ...(data.holds || []).map((h) => ({ ...h, _g: 'hold' })),
    ...(data.stable || []).map((s) => ({ ...s, _g: 'stable' })),
  ]

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <span className="text-green-400 font-semibold">{data.deals?.length} deals</span>
        <span className="text-red-400 font-semibold">{data.holds?.length} holds</span>
        <span className="text-[#8b949e]">{data.stable?.length} stable</span>
        <span className="text-[#e6edf3] ml-auto">~{formatCurrency(data.savings_potential)} savings</span>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 lg:hidden">
        {allItems.map((item, i) => (
          <div key={i} className={`p-3 rounded-lg border ${
            item._g === 'deal' ? 'border-green-800/50 bg-green-900/10' :
            item._g === 'hold' ? 'border-red-800/50 bg-red-900/10' :
            'border-[rgba(48,54,61,0.5)]'
          }`}>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[#e6edf3] text-sm font-medium flex-1 mr-2">{item.product_name}</p>
              <PriceTagBadge status={item.status} />
            </div>
            <p className="text-[#8b949e] text-xs">
              ${(item.prev_price || 0).toFixed(2)} → ${(item.new_price || 0).toFixed(2)}
              <span className={`ml-2 ${item.change < 0 ? 'text-green-400' : item.change > 0 ? 'text-red-400' : ''}`}>
                {item.change > 0 ? '+' : ''}${(item.change || 0).toFixed(2)}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(48,54,61,0.8)] text-[#8b949e] text-xs">
              <th className="text-left pb-2">Product</th>
              <th className="text-right pb-2">Last</th>
              <th className="text-right pb-2">This Month</th>
              <th className="text-right pb-2">Change</th>
              <th className="text-center pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item, i) => (
              <tr key={i} className={`border-b border-[rgba(48,54,61,0.3)] ${item._g === 'deal' ? 'bg-green-500/5' : item._g === 'hold' ? 'bg-red-500/5' : ''}`}>
                <td className="py-2.5 text-[#e6edf3]">{item.product_name}</td>
                <td className="py-2.5 text-right text-[#8b949e] font-mono">${(item.prev_price || 0).toFixed(2)}</td>
                <td className="py-2.5 text-right text-[#e6edf3] font-mono">${(item.new_price || 0).toFixed(2)}</td>
                <td className={`py-2.5 text-right font-mono ${item.change < 0 ? 'text-green-400' : item.change > 0 ? 'text-red-400' : 'text-[#8b949e]'}`}>
                  {item.change > 0 ? '+' : ''}${(item.change || 0).toFixed(2)}
                </td>
                <td className="py-2.5 text-center"><PriceTagBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!allItems.length && <p className="text-[#8b949e] text-sm text-center py-8">Upload a catalog to see price comparisons.</p>}
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

  return (
    <Layout title="Catalog">
      <UploadZone companies={companies} onUploadDone={(c, m) => { setViewCompanyId(c); setViewMonth(m) }} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select className="input-field flex-1" value={viewCompanyId} onChange={(e) => setViewCompanyId(e.target.value)}>
          <option value="">Select company to view…</option>
          {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="input-field sm:w-44" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} />
      </div>
      {viewCompanyId && <PriceCompareTable companyId={viewCompanyId} month={viewMonth} />}
    </Layout>
  )
}
