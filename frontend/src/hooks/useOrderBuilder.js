import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export function useSmartOrderBuild(month) {
  return useQuery({
    queryKey: ['smart-build', month],
    queryFn: () =>
      client.get(`/orders/smart-build?month=${month}`).then((r) => r.data),
    enabled: !!month,
  })
}
