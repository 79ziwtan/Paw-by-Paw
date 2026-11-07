import { useState } from 'react'
import { Link } from 'react-router'
import { LoadMore } from '../../components/LoadMore'
import { Card } from '../../components/ui'
import { ACTIVITY_TABLES, describeChanges, useActivity, type ActivityRow } from './api'

const FILTERS = [...new Set(Object.values(ACTIVITY_TABLES).map((t) => t.filter!))]
const VERB = { insert: 'added', update: 'changed', delete: 'deleted' } as const
const DOT = { insert: 'bg-emerald-500', update: 'bg-neutral-400', delete: 'bg-amber-500' } as const

/** Owner/admin audit trail: who added, changed or deleted what, newest first. */
export function ActivityFeed() {
  const [filter, setFilter] = useState<string | null>(null)
  const tables = filter ? Object.entries(ACTIVITY_TABLES).filter(([, t]) => t.filter === filter).map(([k]) => k) : null
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity(tables)

  if (isPending) return <p className="text-neutral-500">Loading activity…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const rows = data.pages.flat()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {[null, ...FILTERS].map((f) => (
          <button
            key={f ?? 'all'}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded-full border px-3 text-sm ${filter === f ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
          >
            {f ?? 'All'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-neutral-500">Nothing here yet.</Card>
      ) : (
        <ol className="flex flex-col border-l-2 border-neutral-200 pl-4">
          {rows.map((r) => (
            <li key={r.id} className="relative py-2 text-sm">
              <span className={`absolute top-3.5 -left-[21px] size-2.5 rounded-full ${DOT[r.action as keyof typeof DOT] ?? 'bg-neutral-400'}`} />
              <ActivityLine row={r} />
            </li>
          ))}
        </ol>
      )}
      <LoadMore hasMore={!!hasNextPage} loading={isFetchingNextPage} onLoad={() => fetchNextPage()} label="Load older activity" />
    </div>
  )
}

function ActivityLine({ row: r }: { row: ActivityRow }) {
  const noun = ACTIVITY_TABLES[r.table_name]?.noun ?? r.table_name.replace(/_/g, ' ')
  const verb = VERB[r.action as keyof typeof VERB] ?? r.action
  const who = r.actor?.display_name ?? (r.table_name === 'homework_tasks' && r.action === 'update' ? 'Owner' : 'System')
  const changed = r.action === 'update' ? describeChanges(r.changes) : ''
  const label = r.label && r.table_name !== 'sessions' ? r.label : null

  return (
    <>
      <div>
        <span className="font-medium">{who}</span> {verb} {noun}
        {label && <> “{label}”</>}
        {r.dog_name && (
          <>
            {' '}for{' '}
            {r.dog_id && r.action !== 'delete' ? (
              <Link to={`/dogs/${r.dog_id}`} className="underline">{r.dog_name}</Link>
            ) : (
              r.dog_name
            )}
          </>
        )}
        {changed && <span className="text-neutral-500"> ({changed})</span>}
      </div>
      <div className="text-xs text-neutral-500">{new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
    </>
  )
}
