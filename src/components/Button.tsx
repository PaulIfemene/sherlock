import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'gold' | 'outline' | 'outline-light' | 'ghost'

interface Common {
  variant?: Variant
  size?: 'md' | 'sm'
  className?: string
  children: ReactNode
}

function classes({ variant = 'primary', size = 'md', className = '' }: Omit<Common, 'children'>) {
  return `btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''} ${className}`.trim()
}

export function Button({ variant, size, className, children, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size, className })} {...rest}>
      {children}
    </button>
  )
}

/** Internal routes use the router; absolute URLs and anchors use a plain link. */
export function ButtonLink({ to, variant, size, className, children, external }: Common & { to: string; external?: boolean }) {
  const cls = classes({ variant, size, className })
  if (external || /^(https?:|mailto:|#)/.test(to)) {
    return (
      <a href={to} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  )
}
