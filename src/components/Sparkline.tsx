// Small inline trend line. Solid stroke, no fill gradient.

export function Sparkline({ values, width = 120, height = 32, rising = false, label }: { values: number[]; width?: number; height?: number; rising?: boolean; label?: string }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? `Trend, latest ${values[values.length - 1]}`} className="block overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={rising ? 'var(--color-success)' : 'var(--color-ink)'} strokeWidth={rising ? 2 : 1.5} strokeLinejoin="round" strokeLinecap="round" opacity={rising ? 1 : 0.55} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={rising ? 'var(--color-success)' : 'var(--color-ink)'} />
    </svg>
  )
}
