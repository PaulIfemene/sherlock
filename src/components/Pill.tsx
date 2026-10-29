import type { ReactNode } from 'react'
import { LABEL_NAME, LANG_NAME, LANG_SHORT, STATUS_NAME, type ClaimStatus, type Label, type Lang } from '../lib/format'

export function Eyebrow({ children, tone = 'cream' }: { children: ReactNode; tone?: 'cream' | 'gold' | 'dark' }) {
  const toneCls = tone === 'gold' ? 'bg-gold text-ink' : tone === 'dark' ? 'bg-primary text-white' : ''
  return <span className={`pill-cap ${toneCls}`}>{children}</span>
}

/** Verdict and AI labels. Every pair checked for AA contrast. */
const LABEL_STYLE: Record<Label, string> = {
  likely_false: 'bg-error text-white',
  likely_true: 'bg-success text-white',
  missing_context: 'bg-gold text-ink',
  under_investigation: 'bg-gold-soft text-ink',
  unverified: 'bg-[#ececec] text-ink',
}

export function LabelBadge({ label, size = 'md' }: { label: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!label || !(label in LABEL_NAME)) return <span className="text-ink-mute">–</span>
  const l = label as Label
  return (
    <span className={`inline-flex items-center rounded-full font-bold whitespace-nowrap ${size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]'} ${LABEL_STYLE[l]}`}>
      {LABEL_NAME[l]}
    </span>
  )
}

export function LangChip({ lang, full = false }: { lang: string | null | undefined; full?: boolean }) {
  if (!lang || !(lang in LANG_NAME)) return <span className="text-ink-mute text-[13px]">–</span>
  const l = lang as Lang
  return (
    <span title={LANG_NAME[l]} className="inline-flex items-center rounded-md border border-hairline bg-white px-2 py-0.5 text-[12px] font-bold tracking-wide text-ink">
      {full ? LANG_NAME[l] : LANG_SHORT[l]}
    </span>
  )
}

const STATUS_DOT: Record<ClaimStatus, string> = {
  received: 'bg-[#9a9a9a]',
  assessed: 'bg-ink',
  queued: 'bg-gold',
  published: 'bg-success',
}

export function StatusPill({ status }: { status: string }) {
  const s = (status in STATUS_NAME ? status : 'received') as ClaimStatus
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap">
      <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
      {STATUS_NAME[s]}
    </span>
  )
}

export function DemoTag({ children = 'Demo' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-ink/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-mute">{children}</span>
}
