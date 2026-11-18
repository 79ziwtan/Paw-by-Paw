import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Database } from '../lib/database.types'

/*
 * Waffle UI primitives. The landing page (landing/index.html) copies these looks for its
 * product snippets, so keep the two in step when changing radii, colors or shadows.
 */

export const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-base placeholder:text-neutral-400 focus:border-gold-500 focus:bg-white focus:ring-3 focus:ring-gold-100 focus:outline-none'

export const selectClass =
  'w-full cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-base focus:border-gold-500 focus:ring-3 focus:ring-gold-100 focus:outline-none'

/** Collapsible sections (<details>). */
export const dropdownClass = 'group rounded-2xl border border-neutral-200 bg-white'

/** Small secondary action (Edit, Delete, Rename…). */
export const actionClass =
  'inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-40'

/** Tap chips (tags, 3 Ds, quick answers). `chipOn` = selected. */
export const chipClass = 'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors'
export const chipOn = 'border-gold-500 bg-gold-400 text-neutral-900'
export const chipOff = 'border-neutral-200 bg-white text-neutral-700 hover:border-gold-300'

/** Ink pill with the gold "shelf" shadow, as on the landing page. */
const primaryLook =
  'rounded-full bg-neutral-900 font-semibold text-white shadow-[0_4px_0_var(--color-gold-400)] transition hover:-translate-y-px hover:shadow-[0_5px_0_var(--color-gold-400)] active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-gold-400)]'
const secondaryLook = 'rounded-full border border-neutral-200 bg-white font-semibold text-neutral-800 hover:bg-neutral-100'

export const primaryLinkClass = `flex min-h-12 items-center justify-center gap-2 px-5 ${primaryLook}`
export const secondaryLinkClass = `flex min-h-12 items-center justify-center gap-2 px-5 ${secondaryLook}`

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 px-5 disabled:opacity-50 ${variant === 'primary' ? primaryLook : secondaryLook} ${className}`}
      {...props}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-neutral-800">
      {label}
      {children}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}>{children}</div>
}

/** Small uppercase label (e.g. "PLAN · FOUNDATIONS 2"). */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-bold tracking-[0.1em] text-neutral-500 uppercase ${className}`}>{children}</div>
}

/**
 * Cartoon dog in Waffle colours (honey, caramel, ink): the stand-in when a dog has no photo.
 * Deliberately drawn, not photographic, so it reads as "no photo yet".
 */
export function DogPlaceholder({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="32" fill="var(--color-gold-100)" />
      {/* floppy ears */}
      <path d="M17.5 18.5c-6 2-8.5 12-7.5 19 .6 4.6 5.8 5.6 7.8 1.6l4.6-11.5c1.9-4.8-.3-10.8-4.9-9.1Z" fill="var(--color-gold-700)" />
      <path d="M46.5 18.5c6 2 8.5 12 7.5 19-.6 4.6-5.8 5.6-7.8 1.6l-4.6-11.5c-1.9-4.8.3-10.8 4.9-9.1Z" fill="var(--color-gold-700)" />
      {/* head + eye patch + muzzle */}
      <ellipse cx="32" cy="35" rx="15.5" ry="16.5" fill="var(--color-gold-300)" />
      <ellipse cx="25" cy="30.5" rx="5.2" ry="5.6" fill="var(--color-gold-500)" />
      <ellipse cx="32" cy="42.5" rx="9.5" ry="7.5" fill="var(--color-gold-50)" />
      {/* eyes with a glint */}
      <circle cx="25.5" cy="31" r="2.4" fill="var(--color-neutral-900)" />
      <circle cx="26.4" cy="30.1" r=".85" fill="#fff" />
      <circle cx="38.5" cy="31" r="2.4" fill="var(--color-neutral-900)" />
      <circle cx="39.4" cy="30.1" r=".85" fill="#fff" />
      {/* nose, smile, tongue, cheeks */}
      <path d="M28.6 38.4c0-1.4 1.6-2.1 3.4-2.1s3.4.7 3.4 2.1c0 1.5-1.9 2.8-3.4 2.8s-3.4-1.3-3.4-2.8Z" fill="var(--color-neutral-900)" />
      <path d="M32 41.2v1.9M32 43.1c-1 1.5-3.1 1.7-4.3.6M32 43.1c1 1.5 3.1 1.7 4.3.6" stroke="var(--color-neutral-900)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M30.4 44.4h3.2v1.2c0 1-.7 1.7-1.6 1.7s-1.6-.7-1.6-1.7Z" fill="#ef8d86" />
      <circle cx="21.5" cy="39.5" r="2.1" fill="#f2a093" opacity=".55" />
      <circle cx="42.5" cy="39.5" r="2.1" fill="#f2a093" opacity=".55" />
    </svg>
  )
}

const AVATAR_SIZE = { xs: 'size-5', sm: 'size-9', md: 'size-11', lg: 'size-14', xl: 'size-24' } as const

/** Round dog avatar: the photo when there is one (`src` = a signed URL), otherwise the cartoon dog. */
export function DogAvatar({ name, src, size = 'md', className = '' }: {
  name: string | null
  src?: string | null
  size?: keyof typeof AVATAR_SIZE
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = !!src && failed !== src
  return (
    <span className={`relative flex shrink-0 overflow-hidden rounded-full bg-gold-100 ring-1 ring-black/5 ${AVATAR_SIZE[size]} ${className}`}>
      {showPhoto ? (
        <img src={src} alt={name ? `Photo of ${name}` : ''} className="size-full object-cover" loading="lazy" onError={() => setFailed(src)} />
      ) : (
        <DogPlaceholder className="size-full" />
      )}
    </span>
  )
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

/** Dot + word in a pill, for places with room (summary card). */
export function PaidStatus({ status, detail }: { status: Payment | null; detail?: string | null }) {
  const s = paymentStyle[status ?? 'none']
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">
      <span className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
      {detail && <span className="font-medium">· {detail}</span>}
    </span>
  )
}

/** Red is reserved for safety flags. */
export function FlagBadge({ count, label = 'Flag' }: { count: number | null; label?: string }) {
  if (!count) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-flag-soft px-2 py-0.5 text-xs font-bold whitespace-nowrap text-flag">
      <FlagIcon className="size-3" />
      {label}
    </span>
  )
}

/** Status pill (Up next, Logged…). */
export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'gold' | 'ink' | 'green' | 'orange'; children: ReactNode }) {
  const t = {
    neutral: 'bg-neutral-100 text-neutral-600',
    gold: 'bg-gold-400 text-neutral-900',
    ink: 'bg-neutral-900 text-gold-300',
    green: 'bg-green-50 text-green-800',
    orange: 'bg-orange-50 text-orange-800',
  }[tone]
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${t}`}>{children}</span>
}

/** Plan progress: one bar per stage (done = gold, in progress = striped). */
export function StageBars({ stages }: { stages: { status: 'not_started' | 'in_progress' | 'complete' }[] }) {
  if (!stages.length) return null
  return (
    <div className="flex gap-1.5" aria-hidden>
      {stages.map((s, i) => (
        <span key={i} className={`h-2 flex-1 rounded ${s.status === 'complete' ? 'bg-gold-400' : s.status === 'in_progress' ? 'stage-now' : 'bg-neutral-100'}`} />
      ))}
    </div>
  )
}

/** Duration / Distance / Distraction tile. */
export function MeasureTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-gold-100 bg-gold-50 px-2 py-2 text-center">
      <strong className="block font-display text-lg leading-tight">{value}</strong>
      <span className="text-[11px] text-neutral-500">{label}</span>
    </div>
  )
}

/** Waffle brand mark. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#f0b12e" />
      <path d="M11 3v26M21 3v26M3 11h26M3 21h26" stroke="#b9760c" strokeWidth="2.4" />
    </svg>
  )
}

/**
 * Loading indicator: a round waffle loses a quarter per bite, then grows back whole, on repeat.
 * Animation lives in index.css (.waffle-loader). The same SVG is inlined in index.html for boot.
 */
export function WaffleLoader({ size = 56, label = 'Loading', className = '' }: { size?: number; label?: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  const pockets = [12, 22, 32, 42, 52]
  return (
    <span role="status" className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" className="waffle-loader" aria-hidden>
        <defs>
          <clipPath id={`wc-${id}`}><circle cx="32" cy="32" r="22" /></clipPath>
          <mask id={`wm-${id}`}>
            <rect width="64" height="64" fill="white" />
            <g className="bite-1"><circle cx="44" cy="20" r="16" /><circle cx="37.3" cy="4.5" r="10" /><circle cx="59.5" cy="26.7" r="10" /></g>
            <g className="bite-2"><circle cx="44" cy="44" r="16" /><circle cx="59.5" cy="37.3" r="10" /><circle cx="37.3" cy="59.5" r="10" /></g>
            <g className="bite-3"><circle cx="20" cy="44" r="16" /><circle cx="26.7" cy="59.5" r="10" /><circle cx="4.5" cy="37.3" r="10" /></g>
            <g className="bite-4"><circle cx="20" cy="20" r="16" /><circle cx="4.5" cy="26.7" r="10" /><circle cx="26.7" cy="4.5" r="10" /></g>
          </mask>
        </defs>
        <g className="waffle-body" mask={`url(#wm-${id})`}>
          <circle cx="32" cy="32" r="27" fill="#f0b12e" stroke="#b9760c" strokeWidth="2.5" />
          <g clipPath={`url(#wc-${id})`} fill="#de9614">
            {pockets.flatMap((y) => pockets.map((x) => <rect key={`${x}-${y}`} x={x - 3.5} y={y - 3.5} width="7" height="7" rx="1.6" />))}
          </g>
        </g>
      </svg>
      {label && <span className="text-sm font-medium text-neutral-500">{label}…</span>}
    </span>
  )
}

/** Full-area loading state (page bodies). */
export function PageLoader({ label = 'Loading', full = false }: { label?: string; full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'min-h-dvh' : 'min-h-[50dvh]'}`}>
      <WaffleLoader label={label} />
    </div>
  )
}

/* Icons (stroke, 24px grid). */
type IconProps = { className?: string }
const icon = (d: ReactNode) =>
  function Icon({ className = 'size-5' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {d}
      </svg>
    )
  }
export const FlagIcon = icon(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>)
export const CalendarIcon = icon(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>)
export const DogIcon = icon(<><circle cx="6" cy="9" r="1.6" /><circle cx="10" cy="5.5" r="1.6" /><circle cx="14" cy="5.5" r="1.6" /><circle cx="18" cy="9" r="1.6" /><path d="M12 11c-3 0-5.5 3.5-5.5 6 0 1.6 1.2 2.2 2.6 2.2 1.3 0 1.9-.7 2.9-.7s1.6.7 2.9.7c1.4 0 2.6-.6 2.6-2.2 0-2.5-2.5-6-5.5-6Z" /></>)
export const ChatIcon = icon(<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20 12Z" />)
export const TeamIcon = icon(<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5M17.5 19a5.5 5.5 0 0 0-2-4.3" /></>)
export const PhoneIcon = icon(<path d="M6.6 3.5 9 3l1.6 4-2 1.3a11 11 0 0 0 5.1 5.1l1.3-2 4 1.6-.5 2.4a2 2 0 0 1-2.1 1.6A15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1Z" />)
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const ChevronRight = icon(<path d="m9 6 6 6-6 6" />)
export const PinIcon = icon(<><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></>)
export const ClockIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)
export const ShareIcon = icon(<><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" /></>)
