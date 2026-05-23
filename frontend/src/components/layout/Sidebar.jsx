import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, History,
  BookOpen, Building2, Settings, Package, List, Download,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders/new', label: 'New Order', icon: ShoppingCart, highlight: true },
  { divider: true },
  { to: '/products', label: 'Items List', icon: List },
  { to: '/companies', label: 'Distributors', icon: Building2 },
  { to: '/catalog', label: 'Catalog Upload', icon: BookOpen },
  { to: '/orders', label: 'Order History', icon: History },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { divider: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') { setPrompt(null); setInstalled(true) }
  }

  return { canInstall: !!prompt && !installed, install, installed }
}

export default function Sidebar() {
  const { canInstall, install, installed } = useInstallPrompt()

  return (
    <aside className="hidden lg:flex w-56 shrink-0 h-screen sticky top-0 flex-col bg-[#161b22] border-r border-[rgba(48,54,61,0.8)]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[rgba(48,54,61,0.8)]">
        <div className="text-[#58a6ff] font-bold text-lg tracking-tight">🍾 LiquorStore Pro</div>
        <div className="text-xs text-[#8b949e] mt-0.5">Smart Stock Ordering</div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((item, i) => {
          if (item.divider) return <div key={i} className="my-2 border-t border-[rgba(48,54,61,0.5)]" />
          const { to, label, icon: Icon, highlight } = item
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#58a6ff]/15 text-[#58a6ff] border-l-2 border-[#58a6ff]'
                    : highlight
                    ? 'bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25'
                    : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.5)]'
                )
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* Install App button */}
      <div className="px-3 pb-3 space-y-2">
        {canInstall && (
          <button
            onClick={install}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-[#58a6ff]/10 text-[#58a6ff] hover:bg-[#58a6ff]/20 transition-colors border border-[#58a6ff]/20"
          >
            <Download size={15} />
            Install App
          </button>
        )}
        {installed && (
          <p className="text-xs text-green-400 px-3 py-1">✓ App installed</p>
        )}
        <div className="px-3 text-xs text-[#8b949e]">v2.0.0</div>
      </div>
    </aside>
  )
}
