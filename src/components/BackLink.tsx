import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

/** True when there's an earlier page in this tab's in-app history (not a fresh load or shared link). */
function useHasHistory() {
  return useLocation().key !== 'default'
}

/** Go back one page if we can; otherwise go to `fallback` (e.g. the page was opened directly). */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const hasHistory = useHasHistory()
  return () => (hasHistory ? navigate(-1) : navigate(fallback, { replace: true }))
}

/**
 * Header "‹ Back" link. Returns to whatever page you came from; with no history it
 * links to `fallback` and shows `fallbackLabel` instead.
 */
export function BackLink({ fallback, fallbackLabel, className = 'text-sm text-neutral-500', children }: {
  fallback: string
  fallbackLabel: string
  className?: string
  children?: ReactNode
}) {
  const hasHistory = useHasHistory()
  const goBack = useGoBack(fallback)
  const onClick = (e: MouseEvent) => {
    if (!hasHistory || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    goBack()
  }
  return (
    <Link to={fallback} onClick={onClick} className={className}>
      {children ?? `‹ ${hasHistory ? 'Back' : fallbackLabel}`}
    </Link>
  )
}
