import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../../api/client'
import { formatCurrency } from '../../utils/formatters'

export default function SavingsWidget() {
  // Collect savings from completed orders
  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => client.get('/orders').then((r) => r.data),
  })

  const monthlyData = (orders || [])
    .filter((o) => o.savings_vs_last_month != null)
    .slice(0, 6)
    .reverse()
    .map((o) => ({
      month: o.order_month?.slice(0, 7),
      savings: parseFloat(o.savings_vs_last_month || 0),
    }))

  const totalSaved = monthlyData.reduce((s, d) => s + d.savings, 0)

  return (
    <div className="glass-card p-5">
      <h2 className="text-[#e6edf3] font-semibold mb-1">Savings Tracker</h2>
      <p className="text-green-400 text-2xl font-bold mb-4">{formatCurrency(totalSaved)}</p>
      {monthlyData.length > 0 ? (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 11 }} />
            <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid rgba(48,54,61,0.8)', color: '#e6edf3' }}
              formatter={(v) => formatCurrency(v)}
            />
            <Bar dataKey="savings" fill="#3fb950" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-[#8b949e] text-xs">Complete orders to track savings here.</p>
      )}
    </div>
  )
}
