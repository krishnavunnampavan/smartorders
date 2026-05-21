export const STATUS_CONFIG = {
  DEAL: {
    label: 'DEAL',
    className: 'badge-deal',
    color: '#3fb950',
    description: 'Price dropped — good time to stock up',
  },
  RECOVERY_DEAL: {
    label: '⭐ RECOVERY',
    className: 'badge-recovery',
    color: '#bc8cff',
    description: 'Price finally dropped after being held — stock up extra',
  },
  HOLD: {
    label: 'HOLD',
    className: 'badge-hold',
    color: '#f85149',
    description: 'Price increased — skip this month',
  },
  STABLE: {
    label: 'STABLE',
    className: 'badge-stable',
    color: '#8b949e',
    description: 'Price unchanged',
  },
}

export const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.STABLE

export const formatChange = (change) => {
  if (!change && change !== 0) return ''
  const sign = change > 0 ? '+' : ''
  return `${sign}$${Math.abs(change).toFixed(2)}`
}
