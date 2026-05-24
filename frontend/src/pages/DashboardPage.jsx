import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, TrendingUp, ShoppingCart, AlertTriangle, Plus, Upload, Truck, Phone, Zap, BarChart2 } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import SmartOrderModal from '../components/shared/SmartOrderModal'
import client from '../api/client'
import { formatCurrency, thisMonth } from '../utils/formatters'
import { useOrderStore } from '../store/orderStore'
import toast from 'react-hot-toast'

function StatCard({ label, value, sub, icon: Icon, color = 'text-[#58a6ff]' }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[#8b949e] text-xs uppercase tracking-wider mb-1 truncate">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-[#8b949e] text-xs mt-1 leading-snug">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ml-2 ${color} bg-current/10`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function TodaysDeliveries({ companies }) {
  const today = DAY_NAMES[new Date().getDay()]
  const delivering = (companies || []).filter((c) =>
    c.delivery_days && c.delivery_days.toLowerCase().includes(today.toLowerCase())
  )

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck size={16} className="text-[#58a6ff]" />
        <h2 className="text-[#e6edf3] font-semibold text-sm">Today's Deliveries</h2>
        <span className="text-[#8b949e] text-xs ml-auto">{today}</span>
      </div>
      {delivering.length === 0 ? (
        <p className="text-[#8b949e] text-sm">No deliveries scheduled today.</p>
      ) : (
        <div className="space-y-2">
          {delivering.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(88,166,255,0.07)] border border-[#58a6ff]/20">
              <div className="min-w-0">
                <p className="text-[#e6edf3] text-sm font-medium truncate">{c.name}</p>
                {c.contact_name && (
                  <p className="text-[#8b949e] text-xs truncate">{c.contact_name}</p>
                )}
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`}
                  className="text-[#58a6ff] hover:text-[#79b8ff] p-1.5 rounded-lg hover:bg-[#58a6ff]/10 transition-colors shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PriceAlertFeed({ alerts }) {
  const { addResolvedItem } = useOrderStore()

  const addDealToCart = (item) => {
    addResolvedItem({
      product_id: item.product_id,
      product_name: item.product_name,
      company_id: item.company_id,
      quantity: 1,
      unit_price: item.new_price || 0,
      price_status: item.status,
      source: 'deal',
    })
    toast.success(`${item.product_name} added to cart`)
  }

  const allItems = [
    ...(alerts?.deals || []),
    ...(alerts?.holds || []),
  ]
  if (!allItems.length) return <p className="text-[#8b949e] text-sm py-4 text-center">No price alerts for this month.</p>

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {allItems.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(22,27,34,0.6)] border border-[rgba(48,54,61,0.5)]">
          <div className="min-w-0 mr-2 flex-1">
            <p className="text-[#e6edf3] text-sm font-medium truncate">{item.product_name}</p>
            <p className="text-[#8b949e] text-xs">
              ${item.new_price?.toFixed(2)}
              {item.months_on_hold > 0 && ` · held ${item.months_on_hold}mo`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriceTagBadge status={item.status} showChange change={item.change} />
            {(item.status === 'DEAL' || item.status === 'RECOVERY_DEAL') && (
              <button
                onClick={() => addDealToCart(item)}
                className="text-xs px-2 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors font-medium"
                title="Add to order"
              >
                + Add
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [showSmartOrder, setShowSmartOrder] = useState(false)
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
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const dealCount = alerts?.deals?.length || 0
  const holdCount = alerts?.holds?.length || 0
  const savingsPotential = alerts?.deals?.reduce((s, d) => s + Math.abs(d.change || 0), 0) || 0

  return (
    <Layout title="Dashboard">
      {showSmartOrder && <SmartOrderModal onClose={() => setShowSmartOrder(false)} />}

      {/* Quick actions — horizontal scroll on mobile */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        <button className="btn-primary flex items-center gap-2 whitespace-nowrap shrink-0" onClick={() => navigate('/orders/new')}>
          <ShoppingCart size={15} /> New Order
        </button>
        <button
          onClick={() => setShowSmartOrder(true)}
          className="flex items-center gap-2 whitespace-nowrap shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30 transition-colors"
        >
          <Zap size={15} /> Smart Order
        </button>
        <button className="btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0" onClick={() => navigate('/analytics')}>
          <BarChart2 size={15} /> Analytics
        </button>
        <button className="btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0" onClick={() => navigate('/catalog')}>
          <Upload size={15} /> Upload Catalog
        </button>
        <button className="btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0" onClick={() => navigate('/inventory')}>
          <Plus size={15} /> Update Stock
        </button>
      </div>

      {/* Stat cards: 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Deals" value={dealCount}
          sub={dealCount ? `~${formatCurrency(savingsPotential)} potential` : 'No deals yet'}
          icon={TrendingDown} color="text-green-400" />
        <StatCard label="On Hold" value={holdCount} sub="Skip ordering" icon={TrendingUp} color="text-red-400" />
        <StatCard label="Orders" value={orders?.filter((o) => o.order_month?.startsWith(month.slice(0, 7)))?.length || 0}
          sub="This month" icon={ShoppingCart} color="text-[#58a6ff]" />
        <StatCard label="Low Stock" value={lowStock?.length || 0} sub="Below reorder" icon={AlertTriangle} color="text-yellow-400" />
      </div>

      {/* Main content: stacked on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-4">
          <h2 className="text-[#e6edf3] font-semibold mb-3 flex items-center gap-2">
            Price Intelligence
            <span className="text-xs text-[#8b949e] font-normal">
              {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            {(alerts?.deals?.length > 0) && (
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                {alerts.deals.length} deals — tap + to add
              </span>
            )}
          </h2>
          {alertsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : <PriceAlertFeed alerts={alerts} />}
        </div>

        <div className="space-y-4">
          <TodaysDeliveries companies={companies} />

          <div className="glass-card p-4">
            <h2 className="text-[#e6edf3] font-semibold mb-3 flex items-center gap-2">
              Low Stock
              {lowStock?.length > 0 && (
                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full ml-auto">
                  {lowStock.length} items
                </span>
              )}
            </h2>
            {!lowStock?.length ? (
              <p className="text-[#8b949e] text-sm">All stock levels OK.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#e6edf3] truncate mr-2">{p.name}</span>
                    <span className="text-red-400 font-mono text-xs shrink-0">{p.current_stock}/{p.reorder_level}</span>
                  </div>
                ))}
                {lowStock.length > 8 && (
                  <button onClick={() => navigate('/inventory')} className="text-xs text-[#58a6ff] hover:underline mt-1">
                    View all {lowStock.length} →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      {orders?.length > 0 && (
        <div className="glass-card p-4 mt-4">
          <h2 className="text-[#e6edf3] font-semibold mb-3">Recent Orders</h2>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[380px]">
              <thead>
                <tr className="text-left text-[#8b949e] text-xs border-b border-[rgba(48,54,61,0.8)]">
                  <th className="pb-2 pl-1">Month</th>
                  <th className="pb-2">Items</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-b border-[rgba(48,54,61,0.4)]">
                    <td className="py-2 text-[#e6edf3] pl-1">{o.order_month}</td>
                    <td className="py-2 text-[#8b949e]">{o.total_items ?? '—'}</td>
                    <td className="py-2 text-[#e6edf3]">{o.total_value ? formatCurrency(o.total_value) : '—'}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.status === 'draft' ? 'bg-gray-700 text-gray-300' :
                        o.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-green-900/50 text-green-400'
                      }`}>{o.status}</span>
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
