import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Camera, Trash2, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'
import LoadingSpinner from '../shared/LoadingSpinner'
import PriceTagBadge from '../shared/PriceTagBadge'

const STANDARD_SIZES = ['50ml', '100ml', '200ml', '375ml', '500ml', '750ml', '1L', '1.75L']

function SizeSelect({ value, options, onChange }) {
  const labels = options?.length ? options.map((o) => o.size_label) : STANDARD_SIZES
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[rgba(48,54,61,0.5)] border border-[rgba(48,54,61,0.5)] text-[#e6edf3] text-xs rounded-md px-2 py-1 pr-5 focus:outline-none focus:border-[#58a6ff]/50 cursor-pointer w-full"
      >
        {labels.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
    </div>
  )
}

function UnitSelect({ value, options, onChange }) {
  const opts = options?.length
    ? options
    : [
        { unit_label: 'Bottle',     bottles_per_unit: 1 },
        { unit_label: 'Half Case',  bottles_per_unit: 6 },
        { unit_label: 'Case',       bottles_per_unit: 12 },
        { unit_label: 'Mixed Case', bottles_per_unit: 12 },
      ]
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[rgba(48,54,61,0.5)] border border-[rgba(48,54,61,0.5)] text-[#e6edf3] text-xs rounded-md px-2 py-1 pr-5 focus:outline-none focus:border-[#58a6ff]/50 cursor-pointer w-full"
      >
        {opts.map((o) => <option key={o.unit_label} value={o.unit_label}>{o.unit_label}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
    </div>
  )
}

function calcLineTotal(item) {
  if (!item.unit_price) return null
  const sizeOpt = (item.size_options || []).find((s) => s.size_label === item.selected_size)
  const unitOpt = (item.unit_options || []).find((u) => u.unit_label === item.selected_unit)
  const sizePrice = sizeOpt?.unit_price ?? item.unit_price
  const bpu = unitOpt?.bottles_per_unit ?? item.bottles_per_unit ?? 1
  return +(sizePrice * bpu * item.quantity).toFixed(2)
}

export default function PhotoInput() {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])       // review table rows
  const [unmatched, setUnmatched] = useState([])
  const addItem = useOrderStore((s) => s.addItem)

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    setRows([])
    setUnmatched([])
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await client.post('/ai/photo', form)
      const resolved = (data.resolved || []).map((r) => ({
        ...r,
        selected_size: r.selected_size || '750ml',
        selected_unit: r.selected_unit || 'Case',
        bottles_per_unit: r.bottles_per_unit || 12,
      }))
      setRows(resolved)
      setUnmatched(data.unmatched || [])
      if (resolved.length) toast.success(`Found ${resolved.length} products`)
      if (data.unmatched?.length) toast(`${data.unmatched.length} unmatched`, { icon: '⚠️' })
    } catch {
      // axios interceptor handles
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const updateRow = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const updated = { ...r, [field]: value }
        if (field === 'selected_unit') {
          const unitOpt = (r.unit_options || []).find((u) => u.unit_label === value)
          if (unitOpt) updated.bottles_per_unit = unitOpt.bottles_per_unit
        }
        return updated
      })
    )
  }

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const addAll = () => {
    rows.forEach((item) => {
      const sizeOpt = (item.size_options || []).find((s) => s.size_label === item.selected_size)
        || { size_label: item.selected_size || '750ml' }
      const unitOpt = (item.unit_options || []).find((u) => u.unit_label === item.selected_unit)
        || { unit_label: item.selected_unit || 'Case', bottles_per_unit: item.bottles_per_unit || 12 }
      addItem(item, sizeOpt, unitOpt, item.quantity)
    })
    toast.success(`${rows.length} items added to cart`)
    setRows([])
    setUnmatched([])
    setPreview(null)
  }

  const grandTotal = rows.reduce((s, r) => s + (calcLineTotal(r) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-accent-blue bg-blue-500/10'
            : 'border-[rgba(48,54,61,0.8)] hover:border-[#58a6ff]/50'
        }`}
      >
        <input {...getInputProps()} />
        <Camera size={32} className="mx-auto mb-2 text-[#8b949e]" />
        <p className="text-[#e6edf3] text-sm">
          {isDragActive ? 'Drop the photo here' : 'Drag & drop an order photo, or click to browse'}
        </p>
        <p className="text-[#8b949e] text-xs mt-1">JPEG, PNG, WEBP</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 glass-card">
          <LoadingSpinner size={20} />
          <span className="text-[#8b949e] text-sm">Analyzing image with AI…</span>
        </div>
      )}

      {preview && !loading && (
        <img src={preview} alt="Preview"
          className="rounded-lg max-h-40 w-full object-contain border border-[rgba(48,54,61,0.8)]" />
      )}

      {/* Unmatched items */}
      {unmatched.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/20">
          <p className="text-yellow-300 text-xs font-medium flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} /> {unmatched.length} unmatched — not added
          </p>
          {unmatched.map((u, i) => (
            <p key={i} className="text-[#8b949e] text-xs pl-4">· {u.name} ×{u.qty}</p>
          ))}
        </div>
      )}

      {/* Review table */}
      {rows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[#e6edf3] font-medium text-sm flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-400" />
              Review & edit ({rows.length})
            </h3>
            {grandTotal > 0 && (
              <span className="text-[#58a6ff] text-xs font-semibold">${grandTotal.toFixed(2)}</span>
            )}
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
            {rows.map((item, idx) => {
              const lineTotal = calcLineTotal(item)
              return (
                <div key={idx} className="p-3 rounded-xl bg-[rgba(22,27,34,0.8)] border border-[rgba(48,54,61,0.5)] space-y-2">
                  {/* Name + price status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e6edf3] text-sm font-medium leading-snug truncate">{item.product_name}</p>
                      {item.price_status && <PriceTagBadge status={item.price_status} />}
                    </div>
                    <button onClick={() => removeRow(idx)}
                      className="shrink-0 text-[#8b949e] hover:text-red-400 transition-colors p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Size / Unit / Qty / Total row */}
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <div>
                      <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Size</p>
                      <SizeSelect
                        value={item.selected_size}
                        options={item.size_options}
                        onChange={(v) => updateRow(idx, 'selected_size', v)}
                      />
                    </div>
                    <div>
                      <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Unit</p>
                      <UnitSelect
                        value={item.selected_unit}
                        options={item.unit_options}
                        onChange={(v) => updateRow(idx, 'selected_unit', v)}
                      />
                    </div>
                    <div>
                      <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Qty</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateRow(idx, 'quantity', Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center text-sm hover:bg-[rgba(48,54,61,1)]"
                        >−</button>
                        <span className="text-[#e6edf3] text-sm font-mono w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateRow(idx, 'quantity', item.quantity + 1)}
                          className="w-6 h-6 rounded bg-[rgba(48,54,61,0.8)] text-[#e6edf3] flex items-center justify-center text-sm hover:bg-[rgba(48,54,61,1)]"
                        >+</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#484f58] text-[9px] uppercase mb-0.5">Total</p>
                      <p className="text-[#58a6ff] text-xs font-mono">
                        {lineTotal != null ? `$${lineTotal.toFixed(2)}` : '—'}
                      </p>
                      <p className="text-[#484f58] text-[9px]">
                        {item.quantity * (item.bottles_per_unit || 1)} btl
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button className="btn-primary w-full mt-3" onClick={addAll}>
            Add All {rows.length} to Cart
          </button>
        </div>
      )}
    </div>
  )
}
