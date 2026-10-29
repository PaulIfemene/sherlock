import type { ReactNode } from 'react'

export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`card ${pad ? 'card-pad' : ''} ${className}`}>{children}</div>
}

/** Dashboard panel: title row, optional action, body. */
export function Panel({ title, action, children, className = '', subtitle }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; subtitle?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h2 className="heading-sm">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink-mute">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="heading-sm">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[14px] text-ink-mute">{children}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-[#efefef] ${className}`} />
}
