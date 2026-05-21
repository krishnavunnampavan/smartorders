import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Camera, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function PhotoInput() {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState([])
  const addResolvedItem = useOrderStore((s) => s.addResolvedItem)

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await client.post('/ai/photo', form)
      setParsed(data.resolved || [])
      if (data.resolved?.length) toast.success(`Found ${data.resolved.length} items`)
      if (data.unmatched?.length) toast(`${data.unmatched.length} unmatched`, { icon: '⚠️' })
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const addAll = () => {
    parsed.forEach((i) => addResolvedItem(i))
    setParsed([])
    setPreview(null)
    toast.success('Items added to order')
  }

  return (
    <div className="space-y-5">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-accent-blue bg-blue-500/10'
            : 'border-[rgba(48,54,61,0.8)] hover:border-[#58a6ff]/50'
        }`}
      >
        <input {...getInputProps()} />
        <Camera size={36} className="mx-auto mb-3 text-[#8b949e]" />
        <p className="text-[#e6edf3] text-sm">
          {isDragActive ? 'Drop the photo here' : 'Drag & drop an order photo, or click to browse'}
        </p>
        <p className="text-[#8b949e] text-xs mt-1">JPEG, PNG, WEBP supported</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 glass-card">
          <LoadingSpinner size={20} />
          <span className="text-[#8b949e] text-sm">Analyzing image with AI…</span>
        </div>
      )}

      {preview && !loading && (
        <img src={preview} alt="Preview" className="rounded-lg max-h-48 object-contain border border-[rgba(48,54,61,0.8)]" />
      )}

      {parsed.length > 0 && (
        <div>
          <h3 className="text-[#e6edf3] font-medium mb-3">Matched Products ({parsed.length})</h3>
          <div className="space-y-2 mb-4">
            {parsed.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 glass-card">
                <p className="text-[#e6edf3] text-sm">{item.product_name}</p>
                <span className="text-accent-blue font-mono text-sm">×{item.quantity}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={addAll}>Add All to Order</button>
        </div>
      )}
    </div>
  )
}
