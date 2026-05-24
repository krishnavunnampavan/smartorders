import { useState, useEffect } from 'react'
import { Mic, MicOff, Loader, Plus, X, AlertTriangle, CheckCircle, Search, RotateCcw, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import client from '../../api/client'
import { useOrderStore, calcUnitPrice } from '../../store/orderStore'
import { useDebounce } from '../../hooks/useDebounce'

const STANDARD_SIZES = ['50ml', '100ml', '200ml', '375ml', '500ml', '750ml', '1L', '1.75L']
const UNIT_LABELS = ['Bottle', 'Half Case', 'Case', 'Mixed Case']

// ── Inline search for unmatched items ────────────────────────────────────
function UnmatchedItem({ item, onPromote, onDismiss }) {
  const [query, setQuery] = useState(item.name)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debouncedQ = useDebounce(query, 300)

  const doSearch = async (q) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const { data } = await client.get(`/products?search=${encodeURIComponent(q)}&per_page=8`)
      setResults(data || [])
      setShowResults(true)
    } catch { /* silent */ }
    finally { setSearching(false) }
  }

  useEffect(() => { doSearch(debouncedQ) }, [debouncedQ])

  const pick = (product) => {
    onPromote({
      product_id: product.id,
      product_name: product.name,
      company_id: product.company_id || null,
      quantity: item.qty,
      unit_price: product.unit_price || 0,
      base_unit_price: product.unit_price || 0,
      price_status: product.price_status,
      matched_from: item.name,
      source: 'voice',
      pack: product.pack,
      size_options: product.size_options || STANDARD_SIZES.map((s) => ({ size_label: s, unit_price: null, is_default: s === '750ml' })),
      unit_options: product.unit_options || [
        { unit_label: 'Bottle', bottles_per_unit: 1 },
        { unit_label: 'Half Case', bottles_per_unit: 6 },
        { unit_label: 'Case', bottles_per_unit: 12, is_default: true },
        { unit_label: 'Mixed Case', bottles_per_unit: 12 },
      ],
      selected_size: '750ml',
      selected_unit: 'Case',
      bottles_per_unit: 12,
    })
    setShowResults(false)
  }

  return (
    <div className="p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/20 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-300 text-xs font-medium">"{item.name}" ×{item.qty}</span>
        <button onClick={onDismiss} className="text-[#8b949e] hover:text-red-400 transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e]" />
        <input
          className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-[#0d1117] border border-[rgba(48,54,61,0.6)] text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]/50"
          placeholder="Search product to match…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value) }}
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
        {searching && <Loader size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] animate-spin" />}
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-lg shadow-xl overflow-hidden max-h-44 overflow-y-auto">
          {results.map((p) => (
            <button key={p.id} onClick={() => pick(p)}
              className="w-full text-left px-3 py-2 hover:bg-[rgba(48,54,61,0.6)] transition-colors border-b border-[rgba(48,54,61,0.3)] last:border-0">
              <p className="text-[#e6edf3] text-xs font-medium truncate">{p.name}</p>
              {p.unit_size && <p className="text-[#8b949e] text-[10px]">{p.unit_size} · {p.category || ''}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Size pill button ──────────────────────────────────────────────────────
function SizeBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
        active
          ? 'bg-[#58a6ff] text-white'
          : 'bg-[rgba(48,54,61,0.6)] text-[#8b949e] hover:text-[#e6edf3]'
      }`}
    >{label}</button>
  )
}

// ── Unit selector ─────────────────────────────────────────────────────────
function UnitSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[rgba(48,54,61,0.6)] border border-[rgba(48,54,61,0.4)] text-[#e6edf3] text-[10px] rounded-md px-2 py-1 pr-5 focus:outline-none focus:border-[#58a6ff]/50 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.unit_label} value={o.unit_label}>{o.unit_label}</option>
        ))}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
    </div>
  )
}

// ── Single matched product card with size + unit panel ────────────────────
function MatchedItemCard({ item, onRemove, onUpdate }) {
  const sizeOpts = item.size_options?.length
    ? item.size_options
    : STANDARD_SIZES.map((s) => ({ size_label: s, unit_price: null, is_default: s === '750ml' }))

  const unitOpts = item.unit_options?.length
    ? item.unit_options
    : [
        { unit_label: 'Bottle',     bottles_per_unit: 1 },
        { unit_label: 'Half Case',  bottles_per_unit: 6 },
        { unit_label: 'Case',       bottles_per_unit: 12 },
        { unit_label: 'Mixed Case', bottles_per_unit: 12 },
      ]

  const selSize = item.selected_size || '750ml'
  const selUnit = item.selected_unit || 'Case'

  const currentSizeOpt = sizeOpts.find((s) => s.size_label === selSize) || sizeOpts[0]
  const currentUnitOpt = unitOpts.find((u) => u.unit_label === selUnit) || unitOpts[0]

  const effectivePrice = currentSizeOpt?.unit_price != null
    ? (currentSizeOpt.unit_price * currentUnitOpt.bottles_per_unit).toFixed(2)
    : null

  return (
    <div className="p-3 rounded-xl bg-[rgba(22,27,34,0.8)] border border-[rgba(48,54,61,0.6)] space-y-2">
      {/* Product name row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[#e6edf3] text-sm font-medium leading-snug truncate">{item.product_name}</p>
          <p className="text-[#8b949e] text-[10px]">matched from "{item.matched_from}"</p>
        </div>
        <button onClick={() => onRemove(item.product_id)}
          className="shrink-0 text-[#8b949e] hover:text-red-400 transition-colors p-0.5">
          <X size={14} />
        </button>
      </div>

      {/* Size pills */}
      <div className="flex flex-wrap gap-1">
        {sizeOpts.map((s) => (
          <SizeBtn
            key={s.size_label}
            label={s.size_label}
            active={s.size_label === selSize}
            onClick={() => onUpdate(item.product_id, 'size', s.size_label)}
          />
        ))}
      </div>

      {/* Unit + qty + price row */}
      <div className="flex items-center gap-2">
        <UnitSelect
          value={selUnit}
          onChange={(v) => onUpdate(item.product_id, 'unit', v)}
          options={unitOpts}
        />
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onUpdate(item.product_id, 'qty', Math.max(1, item.quantity - 1))}
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)]"
          >−</button>
          <span className="text-[#e6edf3] text-sm font-mono w-6 text-center">{item.quantity}</span>
          <button
            onClick={() => onUpdate(item.product_id, 'qty', item.quantity + 1)}
            className="w-6 h-6 rounded-md bg-[rgba(48,54,61,0.8)] text-[#e6edf3] text-sm flex items-center justify-center hover:bg-[rgba(48,54,61,1)]"
          >+</button>
        </div>
        {effectivePrice && (
          <span className="text-[#58a6ff] text-xs font-mono shrink-0">${effectivePrice}</span>
        )}
      </div>

      {/* Bottle count hint */}
      <p className="text-[#484f58] text-[10px]">
        {currentUnitOpt.bottles_per_unit} btl/{selUnit.toLowerCase()} · {item.quantity * currentUnitOpt.bottles_per_unit} bottles total
      </p>
    </div>
  )
}

// ── Main VoiceInput ───────────────────────────────────────────────────────
export default function VoiceInput() {
  const { recording, error: micError, start, stopAndGetBlob } = useVoiceRecorder()
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [accumulated, setAccumulated] = useState([])
  const [unmatched, setUnmatched] = useState([])
  const addItem = useOrderStore((s) => s.addItem)
  const addResolvedItem = useOrderStore((s) => s.addResolvedItem)

  const handleStopAndParse = async () => {
    const result = await stopAndGetBlob()
    if (!result) return
    const { blob, filename, mimeType } = result
    if (blob.size < 1000) {
      toast.error('Too short — hold the button while speaking')
      return
    }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('audio', blob, filename)
      form.append('mime_type', mimeType)
      const { data } = await client.post('/ai/voice', form)
      if (data.transcript) setTranscript(data.transcript)

      if (data.resolved?.length) {
        setAccumulated((prev) => {
          const existing = new Set(prev.map((p) => p.product_id))
          const newItems = data.resolved.filter((r) => !existing.has(r.product_id))
          const merged = [...prev, ...newItems]
          toast.success(
            newItems.length
              ? `+${newItems.length} item${newItems.length !== 1 ? 's' : ''} — ${merged.length} total`
              : 'All items already in list'
          )
          return merged
        })
      }

      if (data.unmatched?.length) {
        setUnmatched((prev) => {
          const existing = new Set(prev.map((u) => u.name.toLowerCase()))
          const newU = data.unmatched.filter((u) => !existing.has(u.name.toLowerCase()))
          return [...prev, ...newU]
        })
        toast(`${data.unmatched.length} not matched — search below`, { icon: '⚠️' })
      }

      if (!data.resolved?.length && !data.unmatched?.length) {
        toast('Nothing recognized — try again', { icon: '🎙️' })
      }
    } catch { /* axios interceptor handles */ }
    finally { setLoading(false) }
  }

  const updateAccumulated = (productId, field, value) => {
    setAccumulated((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        if (field === 'qty') return { ...item, quantity: value }
        if (field === 'size') return { ...item, selected_size: value }
        if (field === 'unit') {
          const unitOpt = (item.unit_options || []).find((u) => u.unit_label === value) || { unit_label: value, bottles_per_unit: 12 }
          return { ...item, selected_unit: value, bottles_per_unit: unitOpt.bottles_per_unit }
        }
        return item
      })
    )
  }

  const promoteUnmatched = (resolvedItem) => {
    setUnmatched((prev) => prev.filter((u) => u.name !== resolvedItem.matched_from))
    setAccumulated((prev) => {
      if (prev.find((p) => p.product_id === resolvedItem.product_id)) {
        toast('Already in list')
        return prev
      }
      toast.success(`${resolvedItem.product_name} matched`)
      return [...prev, resolvedItem]
    })
  }

  const addAll = () => {
    accumulated.forEach((item) => {
      const sizeOpt = (item.size_options || []).find((s) => s.size_label === item.selected_size)
        || { size_label: item.selected_size || '750ml' }
      const unitOpt = (item.unit_options || []).find((u) => u.unit_label === item.selected_unit)
        || { unit_label: item.selected_unit || 'Case', bottles_per_unit: item.bottles_per_unit || 12 }
      addItem(item, sizeOpt, unitOpt, item.quantity)
    })
    setAccumulated([])
    setUnmatched([])
    setTranscript('')
    toast.success(`${accumulated.length} items added to cart`)
  }

  const clearAll = () => { setAccumulated([]); setUnmatched([]); setTranscript('') }
  const hasItems = accumulated.length > 0 || unmatched.length > 0

  return (
    <div className="space-y-5">
      {/* Mic button */}
      <div className="flex flex-col items-center gap-3 py-5">
        <button
          onClick={recording ? handleStopAndParse : start}
          disabled={loading}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
            recording
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40 scale-105'
              : 'bg-[#58a6ff] hover:bg-blue-400 shadow-lg shadow-blue-500/30 hover:scale-105'
          } disabled:opacity-50 disabled:scale-100`}
        >
          {recording && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />}
          {loading ? <Loader size={30} className="animate-spin" /> :
           recording ? <MicOff size={30} /> : <Mic size={30} />}
        </button>

        <div className="text-center">
          <p className="text-[#8b949e] text-sm">
            {loading ? 'Transcribing & matching…' :
             recording ? 'Recording — tap to stop' :
             accumulated.length > 0 ? 'Tap to record more items' :
             'Tap to start speaking'}
          </p>
          {!recording && !loading && !hasItems && (
            <p className="text-[#8b949e] text-xs mt-1 opacity-60">
              "3 cases Tito's, 2 Hennessy, 5 Modelo"
            </p>
          )}
        </div>

        {micError && (
          <p className="text-red-400 text-xs flex items-center gap-1.5">
            <AlertTriangle size={12} /> {micError}
          </p>
        )}
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="glass-card p-3">
          <p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1">Last heard</p>
          <p className="text-[#e6edf3] text-sm italic">"{transcript}"</p>
        </div>
      )}

      {/* Matched items with size/unit panels */}
      {accumulated.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[#e6edf3] font-medium text-sm flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-400" />
              Matched ({accumulated.length})
            </h3>
            <button onClick={clearAll} className="text-xs text-[#8b949e] hover:text-[#e6edf3] flex items-center gap-1">
              <RotateCcw size={11} /> Clear all
            </button>
          </div>
          <div className="space-y-2">
            {accumulated.map((item) => (
              <MatchedItemCard
                key={item.product_id}
                item={item}
                onRemove={(id) => setAccumulated((prev) => prev.filter((p) => p.product_id !== id))}
                onUpdate={updateAccumulated}
              />
            ))}
          </div>
          <button onClick={addAll} className="btn-primary w-full mt-3 text-sm py-2.5">
            Add All {accumulated.length} Items to Cart
          </button>
        </div>
      )}

      {/* Unmatched with inline search */}
      {unmatched.length > 0 && (
        <div>
          <h3 className="text-[#e6edf3] font-medium text-sm flex items-center gap-1.5 mb-2.5">
            <AlertTriangle size={14} className="text-yellow-400" />
            Not recognized ({unmatched.length}) — search to match
          </h3>
          <div className="space-y-2">
            {unmatched.map((item, i) => (
              <UnmatchedItem
                key={i}
                item={item}
                onPromote={promoteUnmatched}
                onDismiss={() => setUnmatched((prev) => prev.filter((u) => u !== item))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
