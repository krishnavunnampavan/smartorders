import { Bell, Wifi, WifiOff, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import client from '../../api/client'
import { useOrderStore } from '../../store/orderStore'

function CartSyncStatus() {
  const wsStatus = useOrderStore((s) => s.wsStatus)
  const count = useOrderStore((s) => s.connectionCount)

  const color = wsStatus === 'connected'
    ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : wsStatus === 'connecting'
    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30'

  const dot = wsStatus === 'connected' ? 'bg-green-400'
    : wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse'
    : 'bg-red-400'

  const label = wsStatus === 'connected'
    ? count > 1 ? `${count} devices` : 'Live'
    : wsStatus === 'connecting' ? 'Syncing…'
    : 'Offline'

  return (
    <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    if (installed) return
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [installed])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') { setPrompt(null); setInstalled(true) }
  }

  return { canInstall: !!prompt && !installed, install }
}

export default function TopBar({ title }) {
  const [online, setOnline] = useState(navigator.onLine)
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => client.get('/inventory/alerts').then((r) => r.data),
    refetchInterval: 60_000,
    enabled: online,
  })

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-[rgba(48,54,61,0.8)] bg-[#0d1117] shrink-0">
      <div className="flex items-center gap-3">
        <span className="lg:hidden text-[#58a6ff] font-bold text-base">🍾 LiquorPro</span>
        <h1 className="hidden lg:block text-base font-semibold text-[#e6edf3]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <CartSyncStatus />

        {/* Install button — visible on mobile when installable */}
        {canInstall && (
          <button
            onClick={install}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {online ? (
          <Wifi size={16} className="text-green-400 hidden sm:block" />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">
            <WifiOff size={13} /> Offline
          </span>
        )}

        <span className="text-sm text-[#8b949e] hidden md:block">
          {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>

        <div className="relative">
          <Bell size={18} className="text-[#8b949e]" />
          {alerts?.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
