import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, History,
  BookOpen, Building2, Settings, Package,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders/new', label: 'New Order', icon: ShoppingCart },
  { to: '/orders', label: 'Order History', icon: History },
  { to: '/catalog', label: 'Catalog', icon: BookOpen },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-[#161b22] border-r border-[rgba(48,54,61,0.8)]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[rgba(48,54,61,0.8)]">
        <div className="text-accent-blue font-bold text-lg tracking-tight">
          🍾 LiquorStore Pro
        </div>
        <div className="text-xs text-[#8b949e] mt-0.5">Smart Stock Ordering</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#58a6ff]/15 text-[#58a6ff]'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.5)]'
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 text-xs text-[#8b949e] border-t border-[rgba(48,54,61,0.8)]">
        v1.0.0
      </div>
    </aside>
  )
}
