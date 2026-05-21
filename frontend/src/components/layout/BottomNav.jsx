import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, BookOpen, Package, Settings,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/orders/new', label: 'Order', icon: ShoppingCart },
  { to: '/catalog', label: 'Catalog', icon: BookOpen },
  { to: '/inventory', label: 'Stock', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-[#161b22] border-t border-[rgba(48,54,61,0.8)] safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-[#58a6ff]'
                  : 'text-[#8b949e]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  'p-1.5 rounded-xl transition-colors',
                  isActive && 'bg-[#58a6ff]/15'
                )}>
                  <Icon size={20} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
      {/* Safe area spacer for home indicator on iOS */}
      <div className="h-safe-bottom bg-[#161b22]" />
    </nav>
  )
}
