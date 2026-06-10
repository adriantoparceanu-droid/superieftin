interface SparklineProps {
  points: number[]
  belowMedian?: boolean
}

export function Sparkline({ points, belowMedian = false }: SparklineProps) {
  if (points.length < 2) return null

  const W = 80
  const H = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - 2 - ((p - min) / range) * (H - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M${coords.join(' L')}`
  const stroke = belowMedian ? 'var(--color-brand)' : 'var(--color-muted)'

  return (
    <svg width={W} height={H} className="block" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
