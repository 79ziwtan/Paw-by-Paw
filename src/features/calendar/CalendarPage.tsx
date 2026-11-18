import type { DateClickArg } from '@fullcalendar/interaction'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import FullCalendar from '@fullcalendar/react'
import type { DatesSetArg, DayHeaderContentArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, Eyebrow, FlagIcon, primaryLinkClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useDogSummaries } from '../dogs/api'
import { TodayActivity } from '../today/TodayPage'
import { fromDateParam, toDateParam, useAppointments } from './api'

type CalView = 'month' | 'week' | 'day'
type Who = 'mine' | 'all'
const FC_VIEW: Record<CalView, string> = { month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay' }
const FROM_FC = Object.fromEntries(Object.entries(FC_VIEW).map(([k, v]) => [v, k])) as Record<string, CalView>

/** Event status → colour (dot in Month, block in Week/Day; see .waffle-cal in index.css). Red is reserved for safety flags. */
type Status = 'logged' | 'needs-log' | 'now' | 'upcoming'
const LEGEND: { status: Status; label: string }[] = [
  { status: 'upcoming', label: 'Booked' },
  { status: 'now', label: 'In progress' },
  { status: 'needs-log', label: 'Needs log' },
  { status: 'logged', label: 'Logged' },
]

type EventProps = { trainer: string; status: Status; flagged: boolean; location: string; minutes: number }

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** "GMT-05" (or "GMT+05:30"): shown in the corner above the hour labels, like Google Calendar. */
const TZ_LABEL = (() => {
  const off = -new Date().getTimezoneOffset()
  const a = Math.abs(off)
  const m = a % 60
  return `GMT${off >= 0 ? '+' : '-'}${String(Math.floor(a / 60)).padStart(2, '0')}${m ? `:${String(m).padStart(2, '0')}` : ''}`
})()

/** Phone-width check, kept live so rotating or resizing switches the compact layout. */
function useNarrow() {
  const query = '(max-width: 639px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

/** Trainer home: Month / Week / Day calendar. Tap an appointment -> dog summary card; tap an empty slot -> book. */
export function CalendarPage() {
  const { staff } = useAuth()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const calRef = useRef<FullCalendar>(null)
  const [params, setParams] = useSearchParams()

  // View, anchor date and Mine/All live in the URL, so "back" from a dog returns to the same place.
  const [initial] = useState(() => ({
    date: fromDateParam(params.get('date')) ?? new Date(),
    view: (params.get('cv') as CalView | null) ?? (narrow ? 'day' : 'week'),
  }))
  const who: Who = (params.get('view') as Who | null) ?? (staff?.role === 'trainer' ? 'mine' : 'all')
  const [shown, setShown] = useState<{ start: Date; end: Date; title: string; view: CalView } | null>(null)

  // Only touch the URL when something changed: a no-op replace counts as a new page,
  // which would throw away the scroll position that Back is restoring.
  const setUrl = (patch: Record<string, string>) => {
    if (Object.entries(patch).every(([k, v]) => params.get(k) === v)) return
    setParams((p) => {
      const q = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) q.set(k, v)
      return q
    }, { replace: true })
  }

  const { data: dogs = [] } = useDogSummaries()
  const { data: rows = [], isFetching, error } = useAppointments(shown?.start ?? null, shown?.end ?? null)

  // Re-evaluate "in progress" / "needs log" each minute.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const events = useMemo<EventInput[]>(() => {
    const byId = new Map(dogs.map((d) => [d.id, d]))
    return rows.flatMap((r) => {
      const dog = byId.get(r.dog_id) // archived dogs aren't in the summary list, so they drop off
      if (!dog || (who === 'mine' && r.trainer_id !== staff?.id)) return []
      const start = new Date(r.starts_at)
      const end = new Date(start.getTime() + r.duration_minutes * 60_000)
      const status: Status = r.sessions ? 'logged' : end.getTime() < now ? 'needs-log' : start.getTime() <= now ? 'now' : 'upcoming'
      const props: EventProps = {
        trainer: r.trainer?.display_name ?? 'Unassigned',
        status,
        flagged: !!dog.active_flags,
        location: r.location,
        minutes: r.duration_minutes,
      }
      return [{
        id: r.id,
        title: dog.name ?? 'Dog',
        start,
        end,
        url: `/dogs/${r.dog_id}/summary?appointment=${r.id}`,
        classNames: [`wc-${status}`],
        extendedProps: props,
      }]
    })
  }, [rows, dogs, who, staff?.id, now])

  const api = () => calRef.current?.getApi()

  function onDatesSet(arg: DatesSetArg) {
    const view = FROM_FC[arg.view.type] ?? 'week'
    setShown({ start: arg.start, end: arg.end, title: arg.view.title, view })
    // Anchor on the view's current date (first day of the month in Month view).
    setUrl({ date: toDateParam(arg.view.currentStart), cv: view })
  }

  function onEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault()
    if (arg.event.url) navigate(arg.event.url)
  }

  function onDateClick(arg: DateClickArg) {
    const q = new URLSearchParams({ date: toDateParam(arg.date) })
    if (!arg.allDay) q.set('time', hhmm(arg.date))
    navigate(`/appointments/new?${q}`)
  }

  const view = shown?.view ?? initial.view
  const today = toDateParam(new Date(now))
  const isTodayShown = shown ? now >= shown.start.getTime() && now < shown.end.getTime() : true

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-gold-600">Hi {staff?.display_name.split(' ')[0] ?? ''}</Eyebrow>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{shown?.title ?? 'Calendar'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Google Calendar sync is coming soon"
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-neutral-500 ring-1 ring-neutral-200"
          >
            <span className="size-2 rounded-full bg-neutral-300" /> Google Calendar
            <span className="rounded-full bg-gold-100 px-1.5 py-px text-[10px] font-bold tracking-wide text-gold-800 uppercase">Coming soon</span>
          </button>
          <Link to={`/appointments/new?date=${view === 'day' && shown ? toDateParam(shown.start) : today}`} className={`${primaryLinkClass} min-h-10 text-sm`}>
            + New appointment
          </Link>
        </div>
      </header>

      {/* One toolbar row on desktop: navigation left, filters + view right. Wraps on a phone. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            className="min-h-9 rounded-full border border-neutral-200 bg-white px-3.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            disabled={isTodayShown && view === 'day'}
            onClick={() => api()?.today()}
          >
            Today
          </button>
          <button aria-label="Previous" className="flex size-10 items-center justify-center rounded-full text-neutral-600 hover:bg-white" onClick={() => api()?.prev()}>
            <ChevronRight className="size-5 rotate-180" />
          </button>
          <button aria-label="Next" className="flex size-10 items-center justify-center rounded-full text-neutral-600 hover:bg-white" onClick={() => api()?.next()}>
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Whose appointments" value={who} options={[['mine', 'Mine'], ['all', 'All']]} onChange={(v) => setUrl({ view: v })} />
          <Segmented
            label="Calendar view"
            value={view}
            options={[['month', 'Month'], ['week', 'Week'], ['day', 'Day']]}
            onChange={(v) => api()?.changeView(FC_VIEW[v])}
          />
        </div>
      </div>

      {error && <p className="text-sm text-flag">{error.message}</p>}

      <div
        className={`waffle-cal relative rounded-2xl border border-neutral-200 bg-white ${narrow ? 'is-narrow' : ''}`}
        style={{ '--wc-tz': JSON.stringify(TZ_LABEL) } as CSSProperties}
      >
        {isFetching && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse rounded-t-2xl bg-gold-400" aria-hidden />}
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={FC_VIEW[initial.view]}
          initialDate={initial.date}
          headerToolbar={false}
          firstDay={1}
          height="auto"
          events={events}
          eventContent={(arg) => <EventContent arg={arg} narrow={narrow} />}
          dayHeaderContent={(arg) => <DayHeader arg={arg} narrow={narrow} />}
          eventClick={onEventClick}
          dateClick={onDateClick}
          datesSet={onDatesSet}
          navLinks
          navLinkDayClick={(date) => api()?.changeView(FC_VIEW.day, date)}
          nowIndicator
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="21:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotEventOverlap={false}
          expandRows
          displayEventEnd={false}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          slotLabelFormat={{ hour: 'numeric', meridiem: 'short' }}
          views={{
            dayGridMonth: {
              dayHeaderFormat: { weekday: narrow ? 'narrow' : 'short' },
              eventDisplay: 'list-item',
              dayMaxEvents: narrow ? 2 : 4,
              moreLinkClick: 'popover',
              eventTimeFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'narrow' },
            },
            timeGrid: { eventDisplay: 'block', eventMinHeight: 24 },
          }}
        />
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600" aria-label="Legend">
        {LEGEND.map((l) => (
          <li key={l.status} className="flex items-center gap-1.5">
            <span className={`wc-dot wc-${l.status}`} /> {l.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5"><FlagIcon className="size-3.5 text-flag" /> Safety flag</li>
        <li className="text-neutral-500">Tap an empty slot to book.</li>
      </ul>

      {isTodayShown && (
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

/** Column header: "MON" in Month view; "MON" over a big date number (today circled) in Week/Day, like Google. */
function DayHeader({ arg, narrow }: { arg: DayHeaderContentArg; narrow: boolean }) {
  // Month headers are weekday columns, not dates: FullCalendar's arg.date there is a UTC marker that
  // reads as the previous day in local time, so use its pre-formatted text (dayHeaderFormat) instead.
  if (arg.view.type === 'dayGridMonth') return <span className="wc-dow">{arg.text}</span>
  const dow = arg.date.toLocaleDateString(undefined, { weekday: narrow && arg.view.type !== 'timeGridDay' ? 'narrow' : 'short' })
  // Day view: stacked and left-aligned (like Google); Week: centred over each column.
  return (
    <span className={`flex flex-col gap-0.5 ${arg.view.type === 'timeGridDay' ? 'items-start' : 'items-center'}`}>
      <span className={`wc-dow ${arg.isToday ? 'text-gold-700' : ''}`}>{dow}</span>
      <span className={`wc-daynum ${arg.isToday ? 'is-today' : ''}`}>{arg.date.getDate()}</span>
    </span>
  )
}

function EventContent({ arg, narrow }: { arg: EventContentArg; narrow: boolean }) {
  const p = arg.event.extendedProps as EventProps
  const label = `${arg.timeText} ${arg.event.title} with ${p.trainer}${p.location ? `, ${p.location}` : ''}${p.flagged ? ', safety flag' : ''}${p.status === 'logged' ? ', logged' : p.status === 'needs-log' ? ', needs log' : ''}`
  const flag = p.flagged && <FlagIcon className="size-3 shrink-0 text-flag" aria-hidden />
  const done = p.status === 'logged' && <span aria-hidden className="shrink-0 text-paid">✓</span>

  // Month: one slim line, dot · time · dog. No box, no trainer (Google-style).
  if (arg.view.type === 'dayGridMonth') {
    return (
      <span className="flex w-full min-w-0 items-center gap-1.5" title={label} aria-label={label}>
        <span className={`wc-dot wc-${p.status}`} />
        <span className="wc-extra shrink-0 tabular-nums text-neutral-600">{arg.timeText}</span>
        <span className="truncate font-semibold text-neutral-900">{arg.event.title}</span>
        {flag && <span className="wc-extra flex">{flag}</span>}
        {done && <span className="wc-extra flex">{done}</span>}
      </span>
    )
  }

  // Week/Day: dog (bold) first, trainer under it, time last only if the block is tall enough (45+ min).
  const compact = narrow && arg.view.type === 'timeGridWeek'
  const showTime = !compact && p.minutes >= 45
  return (
    <span className="flex h-full min-w-0 flex-col overflow-hidden leading-tight" title={label} aria-label={label}>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-bold">{arg.event.title}</span>
        {/* Phone week columns are ~45px: the name wins; the flag shows in Day view and on the card. */}
        {!compact && flag}
        {!compact && done}
      </span>
      <span className="wc-sub truncate">{p.trainer}</span>
      {showTime && (
        <span className="wc-sub truncate tabular-nums">
          {arg.timeText}
          {arg.view.type === 'timeGridDay' && p.location && ` · ${p.location}`}
        </span>
      )}
    </span>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-white p-1 ring-1 ring-neutral-200">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition-colors ${value === v ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
