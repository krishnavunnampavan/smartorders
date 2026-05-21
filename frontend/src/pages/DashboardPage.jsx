import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, TrendingUp, ShoppingCart, AlertTriangle, Plus, Upload } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency, thisMonth } from '../utils/formatters'

function StatCard({ label, value, sub, icon: Icon, color = 'text-accent-blue' }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#8b949e] text-xs uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-[#8b949e] text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-current/10 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function PriceAlertFeed({ alerts }) {
  const allItems = [
    ...(alerts?.deals || []).map((d) => ({ ...d, type: 'deal' })),
    ...(alerts?.holds || []).map((h) => ({ ...h, type: 'hold' })),
  ]

  if (!allItems.length) {
    return <p className="text-[#8b949e] text-sm">No price alerts for this month.</p>
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {allItems.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(22,27,34,0.6)] border border-[rgba(48,54,61,0.5)]">
          <div className="min-w-0">
            <p className="text-[#e6edf3] text-sm font-medium truncate">{item.product_name}</p>
            <p className="text-[#8b949e] text-xs">
              ${item.new_price?.toFixed(2)}
              {item.months_on_hold > 0 && ` · held ${item.months_on_hold}mo`}
            </p>
          </div>
          <PriceTagBadge status={item.status} showChange change={item.change} />
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const month = thisMonth()

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['price-alerts', month],
    queryFn: () => client.get(`/catalog/alerts?month=${month}`).then((r) => r.data),
  })

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => client.get('/products/low-stock').then((r) => r.data),
  })

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => client.get('/orders').then((r) => r.data),
  })

  const dealCount = alerts?.deals?.length || 0
  const holdCount = alerts?.holds?.length || 0
  const savingsPotential = alerts?.deals?.reduce(
    (sum, d) => sum + Math.abs(d.change || 0), 0
  ) || 0

  return (
    <Layout title="Dashboard">
      {/* Quick actions */}
      <div className="flex gap-3 mb-6">
        <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/orders/new')}>
          <ShoppingCart size={16} /> New Order
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/catalog')}>
          <Upload size={16} /> Upload Catalog
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/inventory')}>
          <Plus size={16} /> Update Stock
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Deals This Month"
          value={dealCount}
          sub={dealCount ? `~${formatCurrency(savingsPotential)} savings potential` : 'No deals yet'}
          icon={TrendingDown}
          color="text-green-400"
        />
        <StatCard
          label="Items On Hold"
          value={holdCount}
          sub="Skip ordering these"
          icon={TrendingUp}
          color="text-red-400"
        />
        <StatCard
          label="Orders This Month"
          value={orders?.filter((o) => o.order_month?.startsWith(month.slice(0, 7)))?.length || 0}
          sub="Active orders"
          icon={ShoppingCart}
          color="text-blue-400"
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStock?.length || 0}
          sub="Below reorder level"
          icon={AlertTriangle}
          color="text-yellow-400"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Price Alert Feed */}
        <div className="col-span-2 glass-card p-5">
          <h2 className="text-[#e6edf3] font-semibold mb-4">
            Price Intelligence Feed
            <span className="ml-2 text-xs text-[#8b949e] font-normal">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </h2>
          {alertsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <PriceAlertFeed alerts={alerts} />
          )}
        </div>

        {/* Low Stock Panel */}
        <div className="glass-card p-5">
          <h2 className="text-[#e6edf3] font-semibold mb-4">Low Stock</h2>
          {!lowStock?.length ? (
            <p className="text-[#8b949e] text-sm">All stock levels OK.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-[#e6edf3] truncate max-w-[120px]">{p.name}</span>
                  <span className="text-red-400 font-mono text-xs">
                    {p.current_stock}/{p.reorder_level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      {orders?.length > 0 && (
        <div className="glass-card p-5 mt-6">
          <h2 className="text-[#e6edf3] font-semibold mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#8b949e] border-b border-[rgba(48,54,61,0.8)]">
                  <th className="pb-2">Month</th>
                  <th className="pb-2">Items</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-b border-[rgba(48,54,61,0.4)]">
                    <td className="py-2 text-[#e6edf3]">{o.order_month}</td>
                    <td className="py-2 text-[#8b949e]">{o.total_items ?? '—'}</td>
                    <td className="py-2 text-[#e6edf3]">
                      {o.total_value ? formatCurrency(o.total_value) : '—'}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.status === 'draft' ? 'bg-gray-700 text-gray-300' :
                        o.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-green-900/50 text-green-400'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
