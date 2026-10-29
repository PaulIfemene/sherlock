import type { ReactNode } from 'react'

/** Horizontally scrollable table container so dense tables never widen the page. */
export function Table({ children, minWidth = 720, label }: { children: ReactNode; minWidth?: number; label: string }) {
  return (
    <div className="w-full overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="table" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}
