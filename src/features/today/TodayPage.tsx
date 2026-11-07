import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { SessionCard } from '../sessions/SessionCard'
import { useTodayHomework, useTodaySessions, type TodayHomeworkBlock } from './api'

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** Today: only what happened today — sessions logged and homework assigned or completed. */
export function TodayPage() {
  const { staff } = useAuth()
  const sessions = useTodaySessions()
  const homework = useTodayHomework()
  const [dateLabel] = useState(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Hi {staff?.display_name.split(' ')[0]}</h1>
        <p className="text-sm text-neutral-500">{dateLabel}</p>
      </header>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Sessions today{sessions.data && ` (${sessions.data.length})`}</h2>
        {sessions.isPending && <p className="text-sm text-neutral-500">Loading…</p>}
        {sessions.error && <p className="text-sm text-flag">{sessions.error.message}</p>}
        {sessions.data?.length === 0 && (
          <Card className="border-dashed text-center text-sm text-neutral-500">
            No sessions logged yet today. <Link to="/dogs" className="underline">Pick a dog</Link> to log one.
          </Card>
        )}
        <ul className="flex flex-col gap-3">
          {sessions.data?.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} showDog hideHomework />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Homework today{homework.data && ` (${homework.data.length})`}</h2>
        {homework.isPending && <p className="text-sm text-neutral-500">Loading…</p>}
        {homework.error && <p className="text-sm text-flag">{homework.error.message}</p>}
        {homework.data?.length === 0 && (
          <Card className="border-dashed text-center text-sm text-neutral-500">No homework assigned or completed today.</Card>
        )}
        <ul className="flex flex-col gap-3">
          {homework.data?.map((b) => (
            <li key={b.key}>
              <HomeworkBlock block={b} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** One assignment's tasks in a single card, like an owner update on the Updates tab. */
function HomeworkBlock({ block: b }: { block: TodayHomeworkBlock }) {
  const done = b.tasks.filter((t) => t.completed_at).length
  const when = b.assignedToday ? time(b.assignedAt) : day(b.assignedAt)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {b.dog && <Link to={`/dogs/${b.dog.id}?tab=homework`} className="font-semibold hover:underline">{b.dog.name}</Link>}
          <div className="text-xs text-neutral-500">
            {b.source} · {when}
            {b.assignedBy && ` · ${b.assignedBy}`}
            {!b.assignedToday && b.doneToday > 0 && ` · ${b.doneToday} completed today`}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${done === b.tasks.length ? 'bg-neutral-900 text-white' : 'bg-neutral-100'}`}>
          {done}/{b.tasks.length} done
        </span>
      </div>
      <ul className="flex flex-col gap-1.5" aria-label="Homework">
        {b.tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <span
              aria-label={t.completed_at ? 'Done' : 'Not done'}
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${t.completed_at ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-400'}`}
            >
              {t.completed_at && '✓'}
            </span>
            <span>
              <span className={t.completed_at ? 'text-neutral-500 line-through' : ''}>{t.text}</span>
              {t.completed_at && (
                <span className="ml-1 text-xs text-neutral-400">
                  {sameDay(t.completed_at) ? time(t.completed_at) : day(t.completed_at)} · {t.completer?.display_name ?? (t.update_id ? 'owner' : 'staff')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
