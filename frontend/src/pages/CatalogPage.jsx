import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import {
  Upload, Globe, Zap, CheckCircle, RefreshCw, Clock,
  AlertTriangle, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency, thisMonth } from '../utils/formatters'

// ── Upload history with freshness ─────────────────────────────────────────
function daysAgo(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function FreshnessChip({ days }) {
  if (days === null) return null
  if (days === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Today</span>
  if (days <= 7) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">{days}d ago</span>
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400">{days}d ago</span>
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
      <AlertTriangle size={10} /> {days}d ago — stale
    </span>
  )
}

function UploadHistory({ onSelectCompany }) {
  const [expanded, setExpanded] = useState(true)

  const { data: uploads, isLoading } = useQuery({
    queryKey: ['catalog-uploads'],
    queryFn: () => client.get('/catalog/uploads').then((r) => r.data),
    staleTime: 30_000,
  })

  if (isLoading) return null
  if (!uploads?.length) return (
    <div className="glass-card p-4 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={15} className="text-[#8b949e]" />
        <h2 className="text-[#e6edf3] font-semibold text-sm">Upload History</h2>
      </div>
      <p className="text-[#8b949e] text-xs">No catalogs uploaded yet.</p>
    </div>
  )

  // Group by company — show latest upload per company at the top
  const byCompany = {}
  for (const u of uploads) {
    const cid = u.company_id || 'unknown'
    if (!byCompany[cid]) byCompany[cid] = []
    byCompany[cid].push(u)
  }

  // Stale companies (latest upload > 30 days ago)
  const staleCount = Object.values(byCompany).filter((list) => {
    const latest = list[0]
    return daysAgo(latest.created_at) > 30
  }).length

  return (
    <div className="glass-card mb-5">
      <button
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[rgba(48,54,61,0.5)]"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-[#58a6ff]" />
          <span className="text-[#e6edf3] font-semibold text-sm">Upload History</span>
          <span className="text-xs text-[#8b949e] bg-[rgba(48,54,61,0.6)] px-2 py-0.5 rounded-full">
            {Object.keys(byCompany).length} companies
          </span>
          {staleCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> {staleCount} stale
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-[#8b949e]" /> : <ChevronDown size={15} className="text-[#8b949e]" />}
      </button>

      {expanded && (
        <div className="divide-y divide-[rgba(48,54,61,0.4)]">
          {Object.entries(byCompany).map(([cid, list]) => {
            const latest = list[0]
            const days = daysAgo(latest.created_at)
            const isStale = days > 30

            return (
              <div key={cid} className={`px-4 py-3 ${isStale ? 'bg-red-900/5' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#e6edf3] text-sm font-medium truncate">{latest.company_name}</p>
                      <FreshnessChip days={days} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[#8b949e] text-xs flex-wrap">
                      <span className="flex items-center gap-1">
                        <FileText size={10} /> {latest.file_name || 'catalog'}
                      </span>
                      <span>{latest.items_parsed} parsed · {latest.items_matched} matched</span>
                      <span>{latest.upload_month}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isStale && (
                      <span className="text-[10px] text-red-400 text-right leading-tight hidden sm:block">
                        Update<br />needed
                      </span>
                    )}
                    <button
                      onClick={() => onSelectCompany(latest.company_id, latest.upload_month)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#58a6ff]/10 text-[#58a6ff] hover:bg-[#58a6ff]/20 transition-colors whitespace-nowrap"
                    >
                      View prices
                    </button>
                  </div>
                </div>

                {/* Past uploads for this company (collapsed, show count) */}
                {list.length > 1 && (
                  <p className="text-[#8b949e] text-[10px] mt-1.5">
                    + {list.length - 1} previous upload{list.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Monaco auto-import ────────────────────────────────────────────────────
function MonacoImport({ onDone }) {
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)

  const handlePreview = async () => {
    setStatus('previewing')
    try {
      const { data } = await client.get('/scraper/preview?max_products=30')
      setPreview(data)
      setStatus('previewed')
    } catch {
      setStatus(null)
    }
  }

  const handleImport = async () => {
    setStatus('importing')
    try {
      const { data } = await client.post('/scraper/import-monaco?max_products=500')
      toast.success(
        `Imported ${data.products_imported} products from ${data.company} ` +
        `(${data.company_created ? 'company auto-created' : 'matched existing company'})`
      )
      setPreview(null)
      setStatus('done')
      onDone?.()
    } catch {
      setStatus(null)
    }
  }

  return (
    <div className="glass-card p-4 mb-5 border border-[#58a6ff]/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-[#58a6ff]/10">
          <Globe size={18} className="text-[#58a6ff]" />
        </div>
        <div>
          <h2 className="text-[#e6edf3] font-semibold">Monaco's Wine & Liquor</h2>
          <p className="text-[#8b949e] text-xs">monacoswineliquor.com — auto-scrape inventory</p>
        </div>
        <div className="ml-auto flex gap-2">
          {status !== 'done' && (
            <button
              className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
              onClick={handlePreview}
              disabled={status === 'previewing' || status === 'importing'}
            >
              {status === 'previewing' ? <LoadingSpinner size={13} /> : <Zap size={13} />}
              Preview
            </button>
          )}
          <button
            className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
            onClick={status === 'done' ? handlePreview : handleImport}
            disabled={status === 'previewing' || status === 'importing'}
          >
            {status === 'importing' ? (
              <><LoadingSpinner size={13} /> Importing…</>
            ) : status === 'done' ? (
              <><RefreshCw size={13} /> Re-sync</>
            ) : (
              <><Upload size={13} /> Import All</>
            )}
          </button>
        </div>
      </div>

      {preview && (
        <div>
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-green-400 font-semibold">{preview.total_found} products found</span>
            <span className="text-[#8b949e]">{preview.pages_scraped} pages scraped</span>
            {preview.company_info?.phone && (
              <span className="text-[#8b949e]">📞 {preview.company_info.phone}</span>
            )}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {preview.products?.slice(0, 20).map((p, i) => (
              <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-[rgba(48,54,61,0.3)]">
                <span className="text-[#e6edf3] truncate flex-1 mr-2">{p.name}</span>
                <span className="text-[#8b949e] shrink-0">{p.category}</span>
                {p.unit_price && (
                  <span className="text-green-400 font-mono shrink-0 ml-2">${p.unit_price.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
          {preview.errors?.length > 0 && (
            <p className="text-yellow-400 text-xs mt-2">
              ⚠ {preview.errors.length} page(s) blocked — imported what was accessible.
            </p>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle size={15} /> Import complete — products added to your catalog
        </div>
      )}
    </div>
  )
}

// ── Manual upload zone ────────────────────────────────────────────────────
function UploadZone({ companies, onUploadDone }) {
  const [companyId, setCompanyId] = useState('')
  const [month, setMonth] = useState(thisMonth().slice(0, 7))
  const [uploading, setUploading] = useState(false)
  const [autoCompany, setAutoCompany] = useState(null)

  const onDrop = async (files) => {
    const file = files[0]
    if (!file) return
    setAutoCompany(null)
    setUploading(true)
    try {
      const form = new FormData()
      if (companyId) form.append('company_id', companyId)
      form.append('upload_month', month + '-01')
      form.append('file', file)
      const { data } = await client.post('/catalog/upload', form)
      if (data.auto_company) {
        setAutoCompany(data.auto_company)
        toast.success(
          `Auto-detected: ${data.auto_company.name}${data.auto_company.was_created ? ' (new company created)' : ''}`
        )
      }
      toast.success(`Parsed ${data.items_parsed} items, matched ${data.items_matched}`)
      onUploadDone(data.company_id || companyId, month + '-01')
    } catch {
      // axios interceptor already shows the error toast; just reset state
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': [], 'image/*': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/vnd.ms-excel': [], 'text/csv': [],
    },
    maxFiles: 1,
  })

  return (
    <div className="glass-card p-4 mb-5">
      <h2 className="text-[#e6edf3] font-semibold mb-1">Upload Catalog</h2>
      <p className="text-[#8b949e] text-xs mb-4">
        Company is auto-detected from the catalog — or select one manually.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select className="input-field flex-1" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Auto-detect company from catalog…</option>
          {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" className="input-field sm:w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {autoCompany && (
        <div className="mb-3 p-3 rounded-lg bg-green-900/20 border border-green-800/50 text-sm flex items-center gap-2">
          <CheckCircle size={15} className="text-green-400 shrink-0" />
          <span className="text-green-300">
            Auto-detected: <strong>{autoCompany.name}</strong>
            {autoCompany.was_created && ' — new company created'}
          </span>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-[#58a6ff] bg-blue-500/10' : 'border-[rgba(48,54,61,0.8)] hover:border-[#58a6ff]/50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading
          ? <div className="flex items-center justify-center gap-3"><LoadingSpinner size={20} /><span className="text-[#8b949e] text-sm">Parsing catalog with AI…</span></div>
          : <>
              <Upload size={26} className="mx-auto mb-2 text-[#8b949e]" />
              <p className="text-[#e6edf3] text-sm font-medium">{isDragActive ? 'Drop it here' : 'Drop catalog here or tap to browse'}</p>
              <p className="text-[#8b949e] text-xs mt-1">PDF, Excel, CSV, or Image</p>
            </>
        }
      </div>
    </div>
  )
}

// ── Price compare table ────────────────────────────────────────────────────
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
              <tr key={i} className={`border-b border-[rgba(48,54,61,0.3)] ${
                item._g === 'deal' ? 'bg-green-500/5' : item._g === 'hold' ? 'bg-red-500/5' : ''
              }`}>
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function CatalogPage() {
  const qc = useQueryClient()
  const [viewCompanyId, setViewCompanyId] = useState('')
  const [viewMonth, setViewMonth] = useState(thisMonth())

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const handleImportDone = () => {
    qc.invalidateQueries(['companies'])
    qc.invalidateQueries(['products'])
    qc.invalidateQueries(['catalog-uploads'])
  }

  const handleUploadDone = (companyId, month) => {
    qc.invalidateQueries(['catalog-uploads'])
    setViewCompanyId(companyId)
    setViewMonth(month)
  }

  const handleSelectCompany = (companyId, uploadMonth) => {
    setViewCompanyId(companyId)
    setViewMonth(uploadMonth)
    // Scroll to price compare section
    setTimeout(() => {
      document.getElementById('price-compare-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <Layout title="Catalog & Price Intelligence">
      {/* Monaco auto-import */}
      <MonacoImport onDone={handleImportDone} />

      {/* Manual catalog upload */}
      <UploadZone companies={companies} onUploadDone={handleUploadDone} />

      {/* Upload history */}
      <UploadHistory onSelectCompany={handleSelectCompany} />

      {/* Price compare section */}
      <div id="price-compare-section">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select className="input-field flex-1" value={viewCompanyId} onChange={(e) => setViewCompanyId(e.target.value)}>
            <option value="">Select company to view price comparison…</option>
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" className="input-field sm:w-44" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} />
        </div>
        {viewCompanyId && <PriceCompareTable companyId={viewCompanyId} month={viewMonth} />}
      </div>
    </Layout>
  )
}
