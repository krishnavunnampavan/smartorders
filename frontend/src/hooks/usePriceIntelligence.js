import { useQuery } from '@tanstack/react-query'
import client from '../api/client'
import { thisMonth } from '../utils/formatters'

export function usePriceIntelligence(month = thisMonth()) {
  const { data, isLoading } = useQuery({
    queryKey: ['price-alerts', month],
    queryFn: () => client.get(`/catalog/alerts?month=${month}`).then((r) => r.data),
  })

  const deals = data?.deals || []
  const holds = data?.holds || []
  const savingsPotential = deals.reduce((s, d) => s + Math.abs(d.change || 0), 0)
  const recoveryDeals = deals.filter((d) => d.status === 'RECOVERY_DEAL')

  return { deals, holds, savingsPotential, recoveryDeals, isLoading }
}
