import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { DollarSign, ShoppingBag, TrendingDown, BarChart2 } from 'lucide-react'
import Layout from '../components/layout/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'

const CHART_COLORS = [
  '#58a6ff', '#3fb950', '#f78166', '#d2a8ff', '#ffa657',
  '#79c0ff', '#56d364', '#ff7b72', '#bc8cff', '#e3b341',
]

function KpiCard({ label, value, icon: Icon, color = 'text-[#58a6ff]' }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#8b949e] text-xs uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${color} bg-current/10 shrink-0`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-[#8b949e] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-[#161b22] border border-[rgba(48,54,61,0.8)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#e6edf3] font-medium">{name}</p>
      <p className="text-[#8b949e]">{formatCurrency(value)}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => client.get('/analytics/summary').then((r) => r.data),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <Layout title="Analytics">
        <div className="flex justify-center items-center py-32">
          <LoadingSpinner />
        </div>
      </Layout>
    )
  }

  const { kpis, monthly_totals, by_company, by_category } = data || {}

  const hasData = monthly_totals?.length > 0

  return (
    <Layout title="Analytics">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Spent" value={formatCurrency(kpis?.total_spent)} icon={DollarSign} color="text-[#58a6ff]" />
        <KpiCard label="Total Orders" value={kpis?.total_orders ?? 0} icon={ShoppingBag} color="text-purple-400" />
        <KpiCard label="Avg Order Value" value={formatCurrency(kpis?.avg_order_value)} icon={BarChart2} color="text-yellow-400" />
        <KpiCard label="Total Savings" value={formatCurrency(kpis?.total_savings)} icon={TrendingDown} color="text-green-400" />
      </div>

      {!hasData ? (
        <div className="glass-card p-16 text-center text-[#8b949e]">
          <BarChart2 size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium text-[#e6edf3] mb-1">No order data yet</p>
          <p className="text-sm">Complete some orders to see analytics here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Monthly spend bar chart */}
          <div className="glass-card p-5">
            <h2 className="text-[#e6edf3] font-semibold mb-4">Monthly Spend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly_totals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,0.06)' }} />
                <Bar dataKey="total" name="Spend" fill="#58a6ff" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Company + Category side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Spend by distributor */}
            <div className="glass-card p-5">
              <h2 className="text-[#e6edf3] font-semibold mb-4">Spend by Distributor</h2>
              {by_company?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      layout="vertical"
                      data={by_company}
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: '#8b949e', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="company"
                        tick={{ fill: '#8b949e', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={100}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,0.06)' }} />
                      <Bar dataKey="total" name="Spend" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {by_company.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <p className="text-[#8b949e] text-sm py-8 text-center">No split data yet. Split an order first.</p>
              )}
            </div>

            {/* Spend by category */}
            <div className="glass-card p-5">
              <h2 className="text-[#e6edf3] font-semibold mb-4">Spend by Category</h2>
              {by_category?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={by_category}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      paddingAngle={2}
                    >
                      {by_category.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(v) => <span style={{ color: '#8b949e', fontSize: 11 }}>{v}</span>}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[#8b949e] text-sm py-8 text-center">No category data yet.</p>
              )}
            </div>
          </div>

          {/* Monthly savings highlight */}
          {monthly_totals?.some((m) => m.savings > 0) && (
            <div className="glass-card p-5">
              <h2 className="text-[#e6edf3] font-semibold mb-4">Deal Savings by Month</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthly_totals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v.toFixed(0)}`} width={42} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(63,185,80,0.06)' }} />
                  <Bar dataKey="savings" name="Savings" fill="#3fb950" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
