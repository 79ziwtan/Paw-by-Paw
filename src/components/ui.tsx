import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Database } from '../lib/database.types'

export const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base focus:border-neutral-900 focus:outline-none'

/** Dropdowns (<select>) get a darker border than text fields so they read as controls. */
export const selectClass =
  'w-full cursor-pointer rounded-lg border border-neutral-400 bg-white px-3 py-2.5 text-base shadow-sm focus:border-neutral-900 focus:outline-none'

/** Collapsible sections (<details>): bordered box. */
export const dropdownClass = 'group rounded-lg border border-neutral-400 bg-white shadow-sm'

/** Small bordered button for secondary actions (Edit, Delete, Rename…). Use as className. */
export const actionClass =
  'inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'border border-neutral-900 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800'
      : 'border border-neutral-400 bg-white text-neutral-900 shadow-sm hover:bg-neutral-100'
  // min-h-11 = 44px touch target
  return <button className={`min-h-11 rounded-lg px-4 font-medium disabled:opacity-50 ${styles} ${className}`} {...props} />
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
  return <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${className}`}>{children}</div>
}

type Payment = Database['public']['Enums']['payment_status']
const paymentStyle: Record<Payment, { dot: string; label: string }> = {
  current: { dot: 'bg-emerald-500', label: 'Paid up' },
  overdue: { dot: 'bg-amber-500', label: 'Payment overdue' },
  none: { dot: 'bg-neutral-300', label: 'No package' },
}

export function PaymentDot({ status }: { status: Payment | null }) {
  const s = paymentStyle[status ?? 'none']
  return <span title={s.label} aria-label={s.label} className={`inline-block size-2.5 rounded-full ${s.dot}`} />
}

/** Red is reserved for safety flags. */
export function FlagBadge({ count }: { count: number | null }) {
  if (!count) return null
  return <span className="rounded-full bg-flag px-2 py-0.5 text-xs font-semibold text-white">⚑ Flag</span>
}
