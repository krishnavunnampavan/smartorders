import { useState } from 'react'
import { Mic, MicOff, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'

export default function VoiceInput() {
  const { recording, audioBlob, start, stop } = useVoiceRecorder()
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState([])
  const addResolvedItem = useOrderStore((s) => s.addResolvedItem)

  const handleStopAndParse = async () => {
    stop()
    // wait a tick for blob to be set
    setTimeout(async () => {
      if (!audioBlob) return
      setLoading(true)
      try {
        const form = new FormData()
        form.append('audio', audioBlob, 'recording.webm')
        const { data } = await client.post('/ai/voice', form)
        setTranscript(data.transcript || '')
        setParsed(data.resolved || [])
        if (data.resolved?.length) {
          toast.success(`Parsed ${data.resolved.length} items`)
        }
        if (data.unmatched?.length) {
          toast(`${data.unmatched.length} items not matched`, { icon: '⚠️' })
        }
      } catch {
        // Error toast handled by axios interceptor
      } finally {
        setLoading(false)
      }
    }, 200)
  }

  const addAll = () => {
    parsed.forEach((item) => addResolvedItem(item))
    setParsed([])
    setTranscript('')
    toast.success('Items added to order')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 py-6">
        <button
          onClick={recording ? handleStopAndParse : start}
          disabled={loading}
          className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all ${
            recording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/30'
              : 'bg-[#58a6ff] hover:bg-blue-400 shadow-lg shadow-blue-500/20'
          } disabled:opacity-50`}
        >
          {loading ? <Loader size={28} className="animate-spin" /> :
           recording ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        <p className="text-[#8b949e] text-sm">
          {loading ? 'Processing...' : recording ? 'Recording — tap to stop' : 'Tap to start recording'}
        </p>
      </div>

      {transcript && (
        <div className="glass-card p-4">
          <p className="text-xs text-[#8b949e] mb-1 uppercase tracking-wide">Transcript</p>
          <p className="text-[#e6edf3] text-sm">{transcript}</p>
        </div>
      )}

      {parsed.length > 0 && (
        <div>
          <h3 className="text-[#e6edf3] font-medium mb-3">Parsed Items ({parsed.length})</h3>
          <div className="space-y-2 mb-4">
            {parsed.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 glass-card">
                <div>
                  <p className="text-[#e6edf3] text-sm font-medium">{item.product_name}</p>
                  <p className="text-[#8b949e] text-xs">Matched from: "{item.matched_from}"</p>
                </div>
                <span className="text-accent-blue font-mono text-sm">×{item.quantity}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={addAll}>
            Add All to Order
          </button>
        </div>
      )}
    </div>
  )
}
