import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { LoadMore } from '../../components/LoadMore'
import { Card, PaymentDot, primaryLinkClass } from '../../components/ui'
import { formatAge } from '../../lib/format'
import { useDogSessions, usePlanStages } from '../sessions/api'
import { SessionCard } from '../sessions/SessionCard'
import { HomeworkTab } from '../homework/HomeworkTab'
import { useLocationName } from '../households/api'
import { useActiveFlags, useDogSummary } from './api'
import { DogDetails } from './DogDetails'
import { SafetyFlag } from './SafetyFlag'

type Tab = 'sessions' | 'plan' | 'homework'

/** Summary card (F4) on top; full session history below, one box per session. */
export function DogProfilePage() {
  const { dogId = '' } = useParams()
  const { data: dog, isPending, error } = useDogSummary(dogId)
  const { data: flags } = useActiveFlags(dogId)
  const [params] = useSearchParams()
  const locationName = useLocationName()
  const [tab, setTab] = useState<Tab>(() => (['sessions', 'plan', 'homework'].includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'sessions'))

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  return (
    <section className="flex flex-col gap-4 pb-20">
      <header>
        <BackLink fallback="/dogs" fallbackLabel="Dogs" />
        <h1 className="text-2xl font-semibold">{dog.name}</h1>
        <p className="text-sm text-neutral-500">
          {[dog.breed, formatAge(dog.birth_date)].filter(Boolean).join(' · ')} · Owner:{' '}
          <Link to={`/households/${dog.household_id}`} className="underline">{dog.owner_name}</Link>
        </p>
        {locationName(dog.location_id) && <p className="text-sm text-neutral-500">Location: {locationName(dog.location_id)}</p>}
      </header>

      {dog.archived_at && (
        <p className="rounded-md bg-neutral-100 p-3 text-sm">
          This dog was removed. <Link to={`/households/${dog.household_id}`} className="underline">Restore from household</Link>
        </p>
      )}

      {flags?.map((f) => <SafetyFlag key={f.id} flag={f} readOnly={!!dog.archived_at} />)}

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-neutral-500">Current stage</div>
          <div className="font-medium">{dog.current_stage ?? '—'}</div>
        </div>
        <div>
          <div className="text-neutral-500">Payment</div>
          <div className="flex items-center gap-2 font-medium">
            <PaymentDot status={dog.payment_status} />
            {dog.sessions_remaining != null ? `${dog.sessions_remaining} ${dog.sessions_remaining === 1 ? 'session' : 'sessions'} left` : '—'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-neutral-500">Goal</div>
          <div className="font-medium">{dog.goal || '—'}</div>
        </div>
      </Card>

      <DogDetails dogId={dogId} readOnly={!!dog.archived_at} />

      <div role="tablist" className="flex rounded-md bg-neutral-100 p-1">
        {(['sessions', 'plan', 'homework'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-10 flex-1 rounded-md text-sm font-medium capitalize ${tab === t ? 'bg-white' : 'text-neutral-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'sessions' && <SessionList dogId={dogId} />}
      {tab === 'plan' && <PlanSummary dogId={dogId} />}
      {tab === 'homework' && <HomeworkTab dogId={dogId} readOnly={!!dog.archived_at} />}

      {!dog.archived_at && (
        <div className="fixed inset-x-0 bottom-14 border-t border-neutral-200 bg-white p-3">
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <Link to="summary" className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-neutral-600">
                Summary card
              </Link>
              <Link to="log" className={`${primaryLinkClass} flex-1`}>
                Log session
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SessionList({ dogId }: { dogId: string }) {
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useDogSessions(dogId)

  if (isPending) return <p className="text-neutral-500">Loading sessions…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const sessions = data.pages.flat()
  if (sessions.length === 0) {
    return (
      <Card className="border-dashed text-center text-sm text-neutral-500">
        No sessions yet. <Link to="log" className="underline">Log the first one</Link>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">{sessions.length}{hasNextPage ? '+' : ''} sessions, newest first</p>
      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <SessionCard session={s} />
          </li>
        ))}
      </ul>
      <LoadMore hasMore={!!hasNextPage} loading={isFetchingNextPage} onLoad={() => fetchNextPage()} label="Load older sessions" />
    </div>
  )
}

const statusStyle = {
  complete: 'bg-neutral-300 text-neutral-800',
  in_progress: 'bg-gold-400 text-neutral-900',
  not_started: 'bg-neutral-100 text-neutral-500',
} as const
const statusText = { complete: 'Complete', in_progress: 'In progress', not_started: 'Not started' } as const

function PlanSummary({ dogId }: { dogId: string }) {
  const { data: stages, isPending } = usePlanStages(dogId)
  if (isPending) return <p className="text-neutral-500">Loading plan…</p>
  const done = stages?.filter((s) => s.status === 'complete').length ?? 0

  return (
    <div className="flex flex-col gap-3">
      {stages?.length ? (
        <>
          <p className="text-sm text-neutral-500">{done} of {stages.length} stages complete</p>
          <ol className="flex flex-col gap-2">
            {stages.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between p-3">
                  <span className="font-medium">{s.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[s.status]}`}>{statusText[s.status]}</span>
                </Card>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-sm text-neutral-500">No plan yet.</p>
      )}
      <Link to="plan" className="rounded-md border border-neutral-300 bg-white py-3 text-center font-medium">
        {stages?.length ? 'Edit plan' : 'Build plan'}
      </Link>
    </div>
  )
}
