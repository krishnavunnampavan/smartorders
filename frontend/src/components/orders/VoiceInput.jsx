import { useState } from 'react'
import { Mic, MicOff, Loader, Plus, X, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'

export default function VoiceInput() {
  const { recording, error: micError, start, stopAndGetBlob } = useVoiceRecorder()
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState([])
  const [unmatched, setUnmatched] = useState([])
  const addResolvedItem = useOrderStore((s) => s.addResolvedItem)

  const handleStopAndParse = async () => {
    const result = await stopAndGetBlob()
    if (!result) return
    const { blob, filename, mimeType } = result
    if (blob.size < 1000) {
      toast.error('Recording too short — hold the mic button while speaking')
      return
    }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('audio', blob, filename)
      form.append('mime_type', mimeType)
      const { data } = await client.post('/ai/voice', form)
      setTranscript(data.transcript || '')
      setParsed(data.resolved || [])
      setUnmatched(data.unmatched || [])
      if (data.resolved?.length) {
        toast.success(`Matched ${data.resolved.length} item${data.resolved.length !== 1 ? 's' : ''}`)
      } else if (!data.unmatched?.length) {
        toast('Nothing recognized — try again', { icon: '🎙️' })
      }
    } catch {
      // axios interceptor shows the error toast
    } finally {
      setLoading(false)
    }
  }

  const addOne = (item) => {
    addResolvedItem(item)
    setParsed((prev) => prev.filter((p) => p.product_id !== item.product_id))
    toast.success(`${item.product_name} added`)
  }

  const addAll = () => {
    parsed.forEach((item) => addResolvedItem(item))
    setParsed([])
    setTranscript('')
    setUnmatched([])
    toast.success(`${parsed.length} items added to cart`)
  }

  const removeOne = (productId) => {
    setParsed((prev) => prev.filter((p) => p.product_id !== productId))
  }

  const reset = () => {
    setParsed([])
    setTranscript('')
    setUnmatched([])
  }

  const hasResults = parsed.length > 0 || unmatched.length > 0

  return (
    <div className="space-y-5">
      {/* Mic button */}
      <div className="flex flex-col items-center gap-3 py-6">
        <button
          onClick={recording ? handleStopAndParse : start}
          disabled={loading}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
            recording
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40 scale-105'
              : 'bg-[#58a6ff] hover:bg-blue-400 shadow-lg shadow-blue-500/30 hover:scale-105'
          } disabled:opacity-50 disabled:scale-100`}
        >
          {recording && (
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
          )}
          {loading ? <Loader size={30} className="animate-spin" /> :
           recording ? <MicOff size={30} /> : <Mic size={30} />}
        </button>

        <p className="text-[#8b949e] text-sm text-center">
          {loading
            ? 'Transcribing & matching…'
            : recording
            ? 'Recording — tap to stop & parse'
            : 'Tap to start speaking your order'}
        </p>

        {micError && (
          <p className="text-red-400 text-xs text-center flex items-center gap-1">
            <AlertTriangle size={12} /> {micError}
          </p>
        )}

        {!recording && !loading && !hasResults && (
          <p className="text-[#8b949e] text-xs text-center opacity-60 max-w-xs">
            Say something like: "3 cases Tito's, 2 Hennessy VS, 5 Modelo Especial"
          </p>
        )}
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="glass-card p-4">
          <p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1.5">Heard</p>
          <p className="text-[#e6edf3] text-sm leading-relaxed italic">"{transcript}"</p>
        </div>
      )}

      {/* Matched items */}
      {parsed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[#e6edf3] font-medium text-sm flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-400" />
              Matched ({parsed.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={reset} className="text-xs text-[#8b949e] hover:text-[#e6edf3]">
                Clear
              </button>
              <button
                onClick={addAll}
                className="text-xs px-3 py-1 rounded-lg bg-[#3fb950]/20 text-[#3fb950] hover:bg-[#3fb950]/30 font-medium transition-colors"
              >
                Add All
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {parsed.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-3 glass-card group">
                <div className="flex-1 min-w-0">
                  <p className="text-[#e6edf3] text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-[#8b949e] text-xs truncate">from: "{item.matched_from}"</p>
                </div>
                <span className="text-[#8b949e] text-xs font-mono shrink-0">×{item.quantity}</span>
                <button
                  onClick={() => addOne(item)}
                  className="shrink-0 w-7 h-7 rounded-lg bg-[#3fb950]/20 text-[#3fb950] hover:bg-[#3fb950]/30 flex items-center justify-center transition-colors"
                  title="Add to cart"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeOne(item.product_id)}
                  className="shrink-0 w-7 h-7 rounded-lg text-[#8b949e] hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {parsed.length > 1 && (
            <button onClick={addAll} className="btn-primary w-full mt-3 text-sm py-2.5">
              Add All {parsed.length} Items to Cart
            </button>
          )}
        </div>
      )}

      {/* Unmatched items */}
      {unmatched.length > 0 && (
        <div>
          <h3 className="text-[#e6edf3] font-medium text-sm flex items-center gap-1.5 mb-2.5">
            <AlertTriangle size={14} className="text-yellow-400" />
            Not recognized ({unmatched.length})
          </h3>
          <div className="space-y-1.5">
            {unmatched.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/8 border border-yellow-500/15">
                <p className="text-yellow-300 text-xs">"{item.name}"</p>
                <span className="text-[#8b949e] text-xs">×{item.qty}</span>
              </div>
            ))}
          </div>
          <p className="text-[#8b949e] text-xs mt-2 opacity-70">
            These weren't in the product catalog. Try the Manual tab to search by name.
          </p>
        </div>
      )}
    </div>
  )
}
