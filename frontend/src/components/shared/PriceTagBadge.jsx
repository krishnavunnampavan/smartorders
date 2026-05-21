import { getStatusConfig } from '../../utils/priceUtils'

export default function PriceTagBadge({ status, showChange, change }) {
  const cfg = getStatusConfig(status)
  return (
    <span className={cfg.className}>
      {cfg.label}
      {showChange && change != null && (
        <span className="ml-1 font-mono">
          {change > 0 ? '+' : ''}${Math.abs(change).toFixed(2)}
        </span>
      )}
    </span>
  )
}
