export default function LoadingSpinner({ size = 24, className = '' }) {
  return (
    <div
      className={`inline-block rounded-full border-2 border-gray-700 border-t-accent-blue animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
