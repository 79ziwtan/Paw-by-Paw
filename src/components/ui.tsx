import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Database } from '../lib/database.types'

export const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base focus:border-gold-500  focus:outline-none'

/** Dropdowns (<select>) get a darker border than text fields so they read as controls. */
export const selectClass =
  'w-full cursor-pointer rounded-md border border-neutral-400 bg-white px-3 py-2.5 text-base focus:border-gold-500  focus:outline-none'

/** Collapsible sections (<details>): bordered box. */
export const dropdownClass = 'group rounded-md border border-neutral-400 bg-white'

/** Small bordered button for secondary actions (Edit, Delete, Rename…). Use as className. */
export const actionClass =
  'inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 disabled:opacity-40'

/** Tap chips (tags, 3 Ds, quick answers). `chipOn` = selected. */
export const chipClass = 'min-h-11 rounded-md border px-3 text-sm'
export const chipOn = 'border-gold-500 bg-gold-300 text-neutral-900'
export const chipOff = 'border-neutral-300 bg-white text-neutral-800'

/** Primary call-to-action styling for <Link>s that look like the primary Button. */
export const primaryLinkClass =
  'flex min-h-11 items-center justify-center rounded-md border border-gold-500 bg-gold-400 px-4 font-medium text-neutral-900'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'border border-gold-500 bg-gold-400 text-neutral-900'
      : 'border border-neutral-300 bg-white text-neutral-900'
  // min-h-11 = 44px touch target
  return <button className={`min-h-11 rounded-md px-4 font-medium disabled:opacity-50 ${styles} ${className}`} {...props} />
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-neutral-300 bg-white p-4 ${className}`}>{children}</div>
}

type Payment = Database['public']['Enums']['payment_status']
/** Paid / unpaid indicator only — no payment processing. */
const paymentStyle: Record<Payment, { dot: string; label: string }> = {
  current: { dot: 'bg-paid', label: 'Paid' },
  overdue: { dot: 'bg-unpaid', label: 'Unpaid' },
  none: { dot: 'bg-neutral-300', label: 'No package' },
}

export function PaymentDot({ status }: { status: Payment | null }) {
  const s = paymentStyle[status ?? 'none']
  return <span title={s.label} aria-label={s.label} className={`inline-block size-2.5 shrink-0 rounded-full ${s.dot}`} />
}

/** Dot + word, for places with room (summary card, calendar). */
export function PaidStatus({ status }: { status: Payment | null }) {
  const s = paymentStyle[status ?? 'none']
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
      <span className={`size-2.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

/** Red is reserved for safety flags. */
export function FlagBadge({ count }: { count: number | null }) {
  if (!count) return null
  return <span className="shrink-0 rounded border border-flag px-1.5 text-xs font-medium whitespace-nowrap text-flag">Flag</span>
}
