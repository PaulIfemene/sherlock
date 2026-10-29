import type { ReactNode } from 'react'

export function Kpi({ label, value, hint, tone = 'plain' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'plain' | 'gold' | 'dark' }) {
  const toneCls = tone === 'gold' ? 'bg-gold border-gold' : tone === 'dark' ? 'bg-primary border-primary text-white' : 'bg-white border-hairline'
  return (
    <div className={`rounded-[16px] border p-5 ${toneCls}`}>
      <p className={`micro-cap ${tone === 'dark' ? 'text-on-dark-mute' : tone === 'gold' ? 'text-ink' : 'text-ink-mute'}`}>{label}</p>
      <p className="mt-3 text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums whitespace-nowrap md:text-[34px]">{value}</p>
      {hint && <p className={`mt-2 text-[13px] ${tone === 'dark' ? 'text-on-dark-mute' : tone === 'gold' ? 'text-ink' : 'text-ink-mute'}`}>{hint}</p>}
    </div>
  )
}
