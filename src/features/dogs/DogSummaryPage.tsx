import { Link, useParams, useSearchParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Card, PaidStatus, primaryLinkClass } from '../../components/ui'
import type { Views } from '../../lib/supabase'
import { formatAge, formatPhone } from '../../lib/format'
import { usePlanStages } from '../sessions/api'
import { formatMeasure, MEASURE_FIELDS, type Measures } from '../sessions/measures'
import { useActiveFlags, useDogSummary } from './api'
import { SafetyFlag } from './SafetyFlag'

type LastSession = {
  id: string
  occurred_at: string
  takes_food: boolean | null
  external_notes: string
  next_step?: string
  behaviors: { tag: string; measures: Measures }[] | null
}

const ago = (iso: string) => {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
}

/**
 * Dog summary card (F4): what a trainer needs between back-to-back lessons, on one screen.
 * Reached straight from a calendar appointment. Safety flags are pinned at the top.
 */
export function DogSummaryPage() {
  const { dogId = '' } = useParams()
  const [params] = useSearchParams()
  const { data: dog, isPending, error } = useDogSummary(dogId)
  const { data: flags = [] } = useActiveFlags(dogId)

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const at = params.get('at')
  const last = ((dog.last_sessions ?? []) as LastSession[]).slice(0, 2)

  return (
    <section className="flex flex-col gap-3 pb-36">
      <BackLink fallback="/" fallbackLabel="Calendar" />

      {flags.map((f) => <SafetyFlag key={f.id} flag={f} readOnly={!!dog.archived_at} />)}

      {at && (
        <p className="text-sm text-neutral-600">
          {new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {params.get('kind')} · {params.get('place')} · {params.get('min')} min
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{dog.name}</h1>
            <p className="text-sm text-neutral-500">{[dog.breed, formatAge(dog.birth_date)].filter(Boolean).join(' · ')}</p>
          </div>
          <PaidStatus status={dog.payment_status} />
        </div>

        <Row label="Owner">
          <Link to={`/households/${dog.household_id}`} className="underline">{dog.owner_name}</Link>
          {dog.phone && <> · <a href={`tel:${dog.phone}`} className="underline">{formatPhone(dog.phone)}</a></>}
        </Row>
        <Row label="Package">
          {dog.sessions_remaining != null ? `${dog.sessions_remaining} ${dog.sessions_remaining === 1 ? 'session' : 'sessions'} left` : 'None'}
        </Row>
        <StageRow dogId={dogId} current={dog.current_stage} />
        {dog.goal && <Row label="Goal">{dog.goal}</Row>}
      </Card>

      <h2 className="mt-2 font-semibold">Last 2 sessions</h2>
      {last.length === 0 && <Card className="text-sm text-neutral-500">No sessions logged yet.</Card>}
      {last.map((s) => <LastSessionCard key={s.id} session={s} />)}

      <ActionBar dog={dog} />
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-neutral-500">{label}: </span>
      {children}
    </div>
  )
}

function StageRow({ dogId, current }: { dogId: string; current: string | null }) {
  const { data: stages = [] } = usePlanStages(dogId)
  const idx = stages.findIndex((s) => s.status === 'in_progress')
  return (
    <Row label="Current stage">
      {current ?? 'None in progress'}
      {stages.length > 0 && idx >= 0 && <span className="text-neutral-500"> (stage {idx + 1} of {stages.length})</span>}
    </Row>
  )
}

function LastSessionCard({ session: s }: { session: LastSession }) {
  return (
    <Card className="flex flex-col gap-1 p-3 text-sm">
      <div className="font-medium">
        {ago(s.occurred_at)}
        {s.takes_food != null && <span className="font-normal text-neutral-500"> · {s.takes_food ? 'took food' : 'no food'}</span>}
      </div>
      {s.behaviors?.map((b, i) => {
        const m = b.measures ?? {}
        const parts = MEASURE_FIELDS.filter((f) => m[f.key]).map((f) => formatMeasure(f.key, m[f.key]!))
        return (
          <div key={i}>
            {b.tag}
            {parts.length > 0 && <span className="text-neutral-500"> · {parts.join(' · ')}</span>}
          </div>
        )
      })}
      {s.next_step && <div><span className="text-neutral-500">Next step: </span>{s.next_step}</div>}
      {s.external_notes && <p className="line-clamp-2 text-neutral-600">{s.external_notes}</p>}
    </Card>
  )
}

function ActionBar({ dog }: { dog: Views<'dog_summary'> }) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-10 border-t border-neutral-300 bg-white p-3">
      <div className="mx-auto flex max-w-3xl gap-2">
        <Link to={`/dogs/${dog.id}`} className="flex min-h-11 items-center rounded-md border border-neutral-300 px-3 text-sm">
          Full profile
        </Link>
        {!dog.archived_at && (
          <Link to={`/dogs/${dog.id}/log`} className={`${primaryLinkClass} flex-1`}>
            Log session
          </Link>
        )}
      </div>
    </div>
  )
}
