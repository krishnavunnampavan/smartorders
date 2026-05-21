import { useState, useRef, useCallback } from 'react'

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.current = new MediaRecorder(stream)
    chunks.current = []
    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data)
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      setAudioBlob(blob)
      stream.getTracks().forEach((t) => t.stop())
    }
    mediaRecorder.current.start()
    setRecording(true)
    setAudioBlob(null)
  }, [])

  const stop = useCallback(() => {
    if (mediaRecorder.current?.state !== 'inactive') {
      mediaRecorder.current.stop()
      setRecording(false)
    }
  }, [])

  return { recording, audioBlob, start, stop }
}
