import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import client from '../../api/client'

export default function TopBar({ title }) {
  const [online, setOnline] = useState(navigator.onLine)

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
      {/* Mobile: show app name; Desktop: show page title */}
      <div className="flex items-center gap-3">
        <span className="lg:hidden text-[#58a6ff] font-bold text-base">🍾 LiquorPro</span>
        <h1 className="hidden lg:block text-base font-semibold text-[#e6edf3]">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Connectivity indicator */}
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
