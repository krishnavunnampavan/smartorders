import { useState, useRef, useCallback } from 'react'

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

function mimeToExt(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const mimeTypeRef = useRef('')

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      mimeTypeRef.current = getSupportedMimeType()
      const options = mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : {}
      const mr = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(250)
      setRecording(true)
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Allow mic access in browser settings.'
        : 'Could not access microphone.'
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  // Returns a Promise<{blob, filename}> so callers never deal with stale state
  const stopAndGetBlob = useCallback(() => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') {
        resolve(null)
        return
      }
      mr.onstop = () => {
        const mimeType = mimeTypeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const filename = `recording.${mimeToExt(mimeType)}`
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setRecording(false)
        resolve({ blob, filename, mimeType })
      }
      mr.stop()
    })
  }, [])

  return { recording, error, start, stopAndGetBlob }
}
