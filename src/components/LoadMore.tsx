import { useEffect, useRef } from 'react'
import { Button } from './ui'

/** Fetches the next page when scrolled into view; the button is a fallback. */
export function LoadMore({ hasMore, loading, onLoad, label = 'Load more' }: {
  hasMore: boolean
  loading: boolean
  onLoad: () => void
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Ignore triggers while a page is in flight (fetchNextPage would cancel and restart it).
  const latest = useRef(onLoad)
  useEffect(() => {
    latest.current = () => !loading && onLoad()
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && latest.current(), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore])

  if (!hasMore) return null
  return (
    <div ref={ref}>
      <Button variant="secondary" className="w-full" onClick={() => latest.current()} disabled={loading}>
        {loading ? 'Loading…' : label}
      </Button>
    </div>
  )
}
