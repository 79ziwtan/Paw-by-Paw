import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Card, FlagBadge, PaymentDot } from '../../components/ui'
import { useDogSummaries } from '../dogs/api'
import { TodayActivity } from '../today/TodayPage'
import { useTodaySessions } from '../today/api'
import { mockAppointments, timeLabel, type Appointment } from './mock'

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** Trainer home: Calendar -> tap appointment -> Dog summary card. */
export function CalendarPage() {
  const { data: dogs = [], isPending, error } = useDogSummaries()
  const { data: todaySessions = [] } = useTodaySessions()
  const [today] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(today)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Week strip: Monday to Sunday of the selected week.
  const weekStart = addDays(selected, -((selected.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const appts = useMemo(() => mockAppointments(dogs, selected), [dogs, selected])
  const loggedToday = new Set(todaySessions.map((s) => s.dog_id))
  const isToday = sameDay(selected, today)
  const nextUp = isToday ? appts.find((a) => a.start.getTime() + a.minutes * 60_000 > now.getTime()) : undefined

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">
          {isToday ? 'Today' : selected.toLocaleDateString(undefined, { weekday: 'long' })},{' '}
          {selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </h1>
        <p className="text-sm text-neutral-500">Calendar sync (mockup): Google Calendar</p>
      </header>

      <div className="flex items-center gap-1">
        <button aria-label="Previous week" className="min-h-10 px-2 text-sm text-neutral-600" onClick={() => setSelected(addDays(selected, -7))}>Prev</button>
        <ol className="grid flex-1 grid-cols-7 gap-1">
          {week.map((d) => {
            const on = sameDay(d, selected)
            return (
              <li key={d.toISOString()}>
                <button
                  onClick={() => setSelected(d)}
                  aria-pressed={on}
                  className={`flex w-full flex-col items-center rounded-md border py-1.5 text-xs ${on ? 'border-gold-500 bg-gold-300' : 'border-neutral-300 bg-white'}`}
                >
                  <span>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  <span className={`text-sm ${sameDay(d, today) ? 'font-semibold underline' : ''}`}>{d.getDate()}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <button aria-label="Next week" className="min-h-10 px-2 text-sm text-neutral-600" onClick={() => setSelected(addDays(selected, 7))}>Next</button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Appointments ({appts.length})</h2>
          {!isToday && <button className="text-sm underline" onClick={() => setSelected(today)}>Today</button>}
        </div>
        {isPending && <p className="text-sm text-neutral-500">Loading…</p>}
        {error && <p className="text-sm text-flag">{error.message}</p>}
        {!isPending && appts.length === 0 && <Card className="text-center text-sm text-neutral-500">No appointments.</Card>}
        <ol className="flex flex-col">
          {appts.map((a, i) => (
            <li key={a.id}>
              {i > 0 && <GapLine prev={appts[i - 1]} next={a} />}
              <AppointmentRow
                appt={a}
                status={
                  !isToday ? null
                  : loggedToday.has(a.dog.id!) ? 'Logged'
                  : a.id === nextUp?.id ? (a.start <= now ? 'Now' : 'Up next')
                  : a.start < now ? 'Needs log'
                  : null
                }
              />
            </li>
          ))}
        </ol>
      </div>

      {isToday && (
        <details className="rounded-md border border-neutral-300 bg-white p-3">
          <summary className="cursor-pointer font-semibold">Logged today</summary>
          <div className="mt-3">
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
  return <p className="py-1.5 pl-[76px] text-xs text-neutral-500">{label}</p>
}

function AppointmentRow({ appt: a, status }: { appt: Appointment; status: string | null }) {
  const params = new URLSearchParams({ at: a.start.toISOString(), kind: a.kind, place: a.place, min: String(a.minutes) })
  const highlight = status === 'Now' || status === 'Up next'
  return (
    <Link
      to={`/dogs/${a.dog.id}/summary?${params}`}
      className={`flex gap-3 rounded-md border bg-white p-3 ${highlight ? 'border-gold-500' : 'border-neutral-300'}`}
    >
      <div className="w-16 shrink-0 text-sm">
        <div className="font-medium">{timeLabel(a.start)}</div>
        <div className="text-xs text-neutral-500">{a.minutes} min</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{a.dog.name}</span>
          <PaymentDot status={a.dog.payment_status} />
          <FlagBadge count={a.dog.active_flags} />
          {status && <span className={`ml-auto text-xs ${highlight ? 'font-semibold' : 'text-neutral-500'}`}>{status}</span>}
        </div>
        <div className="truncate text-sm text-neutral-600">{a.dog.owner_name} · {a.kind}</div>
        <div className="truncate text-xs text-neutral-500">{a.place}</div>
      </div>
    </Link>
  )
}
