import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1')

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallEvent(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Register SW silently — no update banner
  useRegisterSW({
    onRegistered(r) { console.log('[PWA] SW registered', r) },
    onRegisterError(e) { console.error('[PWA] SW error', e) },
  })

  const handleInstall = async () => {
    if (!installEvent) return
    installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  if (!installEvent || dismissed) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-96 lg:w-72 z-50">
      <div className="glass-card p-4 border border-[rgba(48,54,61,0.8)] shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">🍾</span>
          <div className="flex-1 min-w-0">
            <p className="text-[#e6edf3] text-sm font-semibold">Install LiquorStore Pro</p>
            <p className="text-[#8b949e] text-xs mt-0.5">Add to home screen for quick access.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={handleInstall}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-1 justify-center">
                <Download size={13} /> Install
              </button>
              <button onClick={handleDismiss} className="btn-secondary text-xs py-1.5 px-3">
                Not now
              </button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-[#8b949e] hover:text-[#e6edf3] shrink-0">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
