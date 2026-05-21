import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { thisMonth } from '../../utils/formatters'

export default function TopBar({ title }) {
  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => client.get('/inventory/alerts').then((r) => r.data),
    refetchInterval: 60_000,
  })

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[rgba(48,54,61,0.8)] bg-[#0d1117]">
      <h1 className="text-base font-semibold text-[#e6edf3]">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#8b949e]">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="relative">
          <Bell size={18} className="text-[#8b949e]" />
          {alerts?.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
