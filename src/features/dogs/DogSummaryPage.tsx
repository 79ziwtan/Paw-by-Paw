import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Card, ClockIcon, DogAvatar, Eyebrow, MeasureTile, PageLoader, PaidStatus, PhoneIcon, Pill, primaryLinkClass, secondaryLinkClass, StageBars } from '../../components/ui'
import { formatAge, formatPhone } from '../../lib/format'
import { HOME } from '../../lib/paths'
import type { Views } from '../../lib/supabase'
import { timeLabel, useAppointment } from '../calendar/api'
import { usePlanStages } from '../sessions/api'
import { MEASURE_FIELDS, tileValue, type Measures } from '../sessions/measures'
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
  const appointmentId = params.get('appointment')
  const { data: appt } = useAppointment(appointmentId)

  if (isPending) return <PageLoader />
  if (error) return <p className="text-flag">{error.message}</p>

  const last = ((dog.last_sessions ?? []) as LastSession[]).slice(0, 2)
  const nextStep = last.find((s) => s.next_step)?.next_step

  return (
    <section className="flex flex-col gap-3.5 pb-36">
      <BackLink fallback={HOME} fallbackLabel="Calendar" className="text-sm font-semibold text-neutral-500" />

      {flags.map((f) => <SafetyFlag key={f.id} flag={f} readOnly={!!dog.archived_at} />)}

      {appt && appt.dog_id === dogId && (
        <div className="flex flex-col gap-1 rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100">
          <div className="flex items-center gap-2.5">
            <ClockIcon className="size-4 shrink-0 text-gold-400" />
            <span className="shrink-0 font-bold text-gold-300">
              {new Date(appt.starts_at).toLocaleDateString(undefined, { weekday: 'short' })} {timeLabel(new Date(appt.starts_at))}
            </span>
            <span className="truncate">{[appt.location, appt.trainer?.display_name].filter(Boolean).join(' · ')}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-400">{appt.duration_minutes} min</span>
            {appt.sessions && <Pill tone="green">Logged</Pill>}
            <Link to={`/appointments/${appt.id}/edit`} className="shrink-0 text-xs font-semibold text-gold-300 hover:underline">Edit</Link>
          </div>
          {appt.notes && <p className="pl-6.5 text-xs text-neutral-300">{appt.notes}</p>}
        </div>
      )}

      <Card className="flex flex-col gap-4 rounded-3xl p-5">
        <div className="flex items-start gap-3.5">
          <DogAvatar name={dog.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl leading-tight font-bold">{dog.name}</h1>
            <p className="text-sm text-neutral-500">{[dog.breed, formatAge(dog.birth_date)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PaidStatus
            status={dog.payment_status}
            detail={dog.sessions_remaining != null ? `${dog.sessions_remaining} ${dog.sessions_remaining === 1 ? 'session' : 'sessions'} left` : null}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
          <div className="min-w-0">
            <Eyebrow>Owner</Eyebrow>
            <Link to={`/households/${dog.household_id}`} className="font-bold hover:underline">{dog.owner_name}</Link>
          </div>
          {dog.phone && (
            <a href={`tel:${dog.phone}`} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold ring-1 ring-neutral-200 hover:bg-neutral-100">
              <PhoneIcon className="size-4" />
              <span className="hidden sm:inline">{formatPhone(dog.phone)}</span><span className="sm:hidden">Call</span>
            </a>
          )}
        </div>

        <Plan dogId={dogId} current={dog.current_stage} goal={dog.goal} />
      </Card>

      {nextStep && (
        <div className="rounded-2xl border border-gold-200 bg-gold-100 px-4 py-3">
          <Eyebrow className="text-gold-800">Pick up from last time</Eyebrow>
          <div className="mt-0.5 font-display text-lg font-bold">{nextStep}</div>
        </div>
      )}

      <h2 className="mt-2 font-display text-xl font-bold">Last 2 sessions</h2>
      {last.length === 0 && <Card className="text-center text-sm text-neutral-500">First session! Nothing logged yet.</Card>}
      {last.map((s) => <LastSessionCard key={s.id} session={s} />)}

      {/* Only link the log to the appointment while it's still unlogged (one log per appointment). */}
      <ActionBar dog={dog} appointmentId={appt && appt.dog_id === dogId && !appt.sessions ? appt.id : null} />
    </section>
  )
}

function Plan({ dogId, current, goal }: { dogId: string; current: string | null; goal: string | null }) {
  const { data: stages = [] } = usePlanStages(dogId)
  const idx = stages.findIndex((s) => s.status === 'in_progress')
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>Plan · {current ?? 'No stage in progress'}</Eyebrow>
        {idx >= 0 && <span className="text-xs text-neutral-500">Stage {idx + 1} of {stages.length}</span>}
      </div>
      <StageBars stages={stages} />
      {goal && <p className="text-sm"><span className="text-neutral-500">Goal: </span>{goal}</p>}
    </div>
  )
}

function LastSessionCard({ session: s }: { session: LastSession }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{ago(s.occurred_at)}</span>
        {s.takes_food != null && <Pill tone={s.takes_food ? 'neutral' : 'orange'}>{s.takes_food ? 'Took food' : 'No food'}</Pill>}
      </div>
      {s.behaviors?.map((b, i) => {
        const m = b.measures ?? {}
        const tiles = MEASURE_FIELDS.filter((f) => m[f.key])
        return (
          <div key={i} className="flex flex-col gap-2">
            <Eyebrow>{b.tag}</Eyebrow>
            {tiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {tiles.map((f) => <MeasureTile key={f.key} value={tileValue(f.key, m[f.key]!)} label={f.label} />)}
              </div>
            )}
          </div>
        )
      })}
      {s.next_step && <Note label="Next step">{s.next_step}</Note>}
      {s.external_notes && <p className="line-clamp-2 text-sm text-neutral-600">{s.external_notes}</p>}
    </Card>
  )
}

function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-600">
      <b className="text-neutral-900">{label}:</b> {children}
    </div>
  )
}

function ActionBar({ dog, appointmentId }: { dog: Views<'dog_summary'>; appointmentId: string | null }) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-10 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-2.5">
        <Link to={`/dogs/${dog.id}`} className={`${secondaryLinkClass} text-sm`}>Full profile</Link>
        {!dog.archived_at && (
          <Link to={`/dogs/${dog.id}/log${appointmentId ? `?appointment=${appointmentId}` : ''}`} className={`${primaryLinkClass} flex-1`}>
            Log session
          </Link>
        )}
      </div>
    </div>
  )
}
