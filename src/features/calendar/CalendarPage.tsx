import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, ChevronRight, DogAvatar, Eyebrow, FlagBadge, PaymentDot, Pill, PinIcon, primaryLinkClass, WaffleLoader } from '../../components/ui'
import type { Views } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useDogSummaries } from '../dogs/api'
import { TodayActivity } from '../today/TodayPage'
import { fromDateParam, timeLabel, toDateParam, useAppointments } from './api'

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

type Appointment = {
  id: string
  dog: Views<'dog_summary'>
  start: Date
  minutes: number
  location: string
  notes: string
  trainerId: string | null
  trainerName: string | null
  sessionId: string | null
}

type Status = 'Now' | 'Up next' | 'Needs log' | 'Logged' | null
const statusTone = { Now: 'ink', 'Up next': 'gold', 'Needs log': 'orange', Logged: 'green' } as const
type View = 'mine' | 'all'

/** Trainer home: Calendar -> tap appointment -> Dog summary card. */
export function CalendarPage() {
  const { staff } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data: dogs = [], isPending: dogsPending, error: dogsError } = useDogSummaries()
  const [today] = useState(() => startOfDay(new Date()))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // The selected day and Mine/All live in the URL so "back" from a dog returns to the same view.
  const selected = fromDateParam(params.get('date')) ?? today
  const view: View = (params.get('view') as View | null) ?? (staff?.role === 'trainer' ? 'mine' : 'all')
  const update = (next: { date?: Date; view?: View }) =>
    setParams(
      (p) => {
        const q = new URLSearchParams(p)
        if (next.date) q.set('date', toDateParam(next.date))
        if (next.view) q.set('view', next.view)
        return q
      },
      { replace: true },
    )
  const setSelected = (date: Date) => update({ date })

  // Week strip: Monday to Sunday of the selected week, fetched in one query.
  const weekStart = addDays(selected, -((selected.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const { data: rows = [], isPending: apptsPending, error: apptsError } = useAppointments(weekStart, addDays(weekStart, 7))
  const weekAppts = useMemo(() => {
    const byId = new Map(dogs.map((d) => [d.id, d]))
    return rows.flatMap((r): Appointment[] => {
      const dog = byId.get(r.dog_id) // archived dogs aren't in the summary list, so they drop off
      if (!dog) return []
      if (view === 'mine' && r.trainer_id !== staff?.id) return []
      return [{
        id: r.id,
        dog,
        start: new Date(r.starts_at),
        minutes: r.duration_minutes,
        location: r.location,
        notes: r.notes,
        trainerId: r.trainer_id,
        trainerName: r.trainer?.display_name ?? null,
        sessionId: r.sessions?.id ?? null,
      }]
    })
  }, [rows, dogs, view, staff?.id])
  const appts = weekAppts.filter((a) => sameDay(a.start, selected))

  const isPending = dogsPending || apptsPending
  const error = dogsError ?? apptsError
  const isToday = sameDay(selected, today)
  const open = appts.filter((a) => !a.sessionId)
  const nextUp = isToday ? open.find((a) => a.start.getTime() + a.minutes * 60_000 > now.getTime()) : undefined
  const statusOf = (a: Appointment): Status =>
    a.sessionId ? 'Logged'
    : !isToday ? (a.start < today ? 'Needs log' : null)
    : a.id === nextUp?.id ? (a.start <= now ? 'Now' : 'Up next')
    : a.start < now ? 'Needs log'
    : null

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-gold-600">
            {isToday ? `Hi ${staff?.display_name.split(' ')[0] ?? ''}` : selected.toLocaleDateString(undefined, { weekday: 'long' })}
          </Eyebrow>
          <h1 className="mt-1 text-4xl font-bold">
            {isToday ? 'Today' : selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {isToday && <span className="ml-2 font-sans text-base font-medium text-neutral-500">{selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
          </h1>
        </div>
        <button
          type="button"
          disabled
          title="Google Calendar sync is coming soon"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 ring-1 ring-neutral-200"
        >
          <span className="size-2 rounded-full bg-neutral-300" /> Google Calendar
          <span className="rounded-full bg-gold-100 px-1.5 py-px text-[10px] font-bold tracking-wide text-gold-800 uppercase">Coming soon</span>
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Whose appointments" className="inline-flex rounded-full bg-white p-1 ring-1 ring-neutral-200">
          {(['mine', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => update({ view: v })}
              className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${view === v ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >
              {v === 'mine' ? 'Mine' : 'All'}
            </button>
          ))}
        </div>
        <Link to={`/appointments/new?date=${toDateParam(selected)}`} className={`${primaryLinkClass} min-h-10 text-sm`}>
          + New appointment
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <button aria-label="Previous week" className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white" onClick={() => setSelected(addDays(selected, -7))}>
          <ChevronRight className="size-5 rotate-180" />
        </button>
        <ol className="grid flex-1 grid-cols-7 gap-1">
          {week.map((d) => {
            const on = sameDay(d, selected)
            const count = weekAppts.filter((a) => sameDay(a.start, d)).length
            return (
              <li key={d.toISOString()}>
                <button
                  onClick={() => setSelected(d)}
                  aria-pressed={on}
                  className={`flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 text-xs transition-colors ${on ? 'bg-neutral-900 text-white' : 'hover:bg-white'}`}
                >
                  <span className={on ? 'text-neutral-300' : 'text-neutral-500'}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  <span className={`font-display text-lg leading-none font-bold ${!on && sameDay(d, today) ? 'text-gold-600' : ''}`}>{d.getDate()}</span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(count, 4) }, (_, i) => <span key={i} className={`size-1 rounded-full ${on ? 'bg-gold-400' : 'bg-gold-300'}`} />)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <button aria-label="Next week" className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white" onClick={() => setSelected(addDays(selected, 7))}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="flex flex-col">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">{appts.length} {appts.length === 1 ? 'appointment' : 'appointments'}</h2>
          {!isToday && <button className="text-sm font-semibold text-gold-700 hover:underline" onClick={() => setSelected(today)}>Back to today</button>}
        </div>
        {isPending && <WaffleLoader className="self-center py-10" />}
        {error && <p className="text-sm text-flag">{error.message}</p>}
        {!isPending && !error && appts.length === 0 && (
          <Card className="text-center text-sm text-neutral-500">
            {view === 'mine' ? 'Nothing booked for you.' : 'Nothing booked.'}{' '}
            <Link to={`/appointments/new?date=${toDateParam(selected)}`} className="font-semibold text-gold-700 hover:underline">Book an appointment</Link>
          </Card>
        )}
        <ol className="flex flex-col">
          {appts.map((a, i) => (
            <li key={a.id}>
              {i > 0 && <GapLine prev={appts[i - 1]} next={a} />}
              <AppointmentRow appt={a} status={statusOf(a)} showTrainer={view === 'all'} />
            </li>
          ))}
        </ol>
      </div>

      {isToday && (
        <details className="group rounded-2xl border border-neutral-200 bg-white p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
            Logged today
            <ChevronRight className="size-5 text-neutral-400 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4">
            <TodayActivity />
          </div>
        </details>
      )}
    </section>
  )
}

/** Time between one appointment ending and the next starting (travel time between back-to-back lessons). */
function GapLine({ prev, next }: { prev: Appointment; next: Appointment }) {
  const mins = Math.round((next.start.getTime() - (prev.start.getTime() + prev.minutes * 60_000)) / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const label = mins <= 0 ? 'Back to back' : `${h ? `${h} hr ` : ''}${m ? `${m} min` : ''}`.trim() + ' between'
  return (
    <div className="flex items-center gap-3 py-1 pl-[34px]">
      <span className="h-6 border-l-2 border-dashed border-neutral-300" />
      <span className={`text-xs font-semibold ${mins <= 15 ? 'text-gold-700' : 'text-neutral-500'}`}>{label}</span>
    </div>
  )
}

function AppointmentRow({ appt: a, status, showTrainer }: { appt: Appointment; status: Status; showTrainer: boolean }) {
  const highlight = status === 'Now' || status === 'Up next'
  return (
    <Link
      to={`/dogs/${a.dog.id}/summary?appointment=${a.id}`}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 transition hover:-translate-y-px hover:shadow-[0_12px_30px_-18px_rgba(100,61,20,.45)] ${highlight ? 'border-gold-400 shadow-[0_0_0_3px_var(--color-gold-100)]' : 'border-neutral-200'} ${status === 'Logged' ? 'opacity-75' : ''}`}
    >
      <div className="w-[60px] shrink-0">
        <div className="text-sm font-bold">{timeLabel(a.start)}</div>
        <div className="text-xs text-neutral-500">{a.minutes} min</div>
      </div>
      <span className={`w-1 self-stretch rounded-full ${a.dog.active_flags ? 'bg-flag' : 'bg-gold-400'}`} />
      <DogAvatar name={a.dog.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold">{a.dog.name}</span>
          <PaymentDot status={a.dog.payment_status} />
          <FlagBadge count={a.dog.active_flags} />
          {status && <span className="ml-auto"><Pill tone={statusTone[status]}>{status}</Pill></span>}
        </div>
        <div className="truncate text-sm text-neutral-600">
          {a.dog.owner_name}
          {showTrainer && <> · {a.trainerName ?? 'Unassigned'}</>}
        </div>
        {a.location && <div className="flex items-center gap-1 truncate text-xs text-neutral-500"><PinIcon className="size-3 shrink-0" />{a.location}</div>}
        {a.notes && <div className="truncate text-xs text-neutral-500 italic">{a.notes}</div>}
      </div>
    </Link>
  )
}
