import { Link } from 'react-router'
import { Card, actionClass } from '../../components/ui'
import { useCan } from '../auth/permissions'
import { useUnsentSessions } from '../updates/api'
import { ShareProfileButton } from '../updates/ShareProfileButton'
import { useDeleteSession } from './api'
import type { SessionRow } from './api'
import { MEASURE_FIELDS, formatMeasure, type Measures } from './measures'

const statusLabel = { not_started: 'not started', in_progress: 'in progress', complete: 'complete' } as const
const statusRank = { not_started: 0, in_progress: 1, complete: 2 } as const

/** One logged session, in its own box. `showDog` adds the dog's name (for lists across dogs); `hideHomework` when homework is shown separately. */
export function SessionCard({ session: s, showDog = false, hideHomework = false }: { session: SessionRow; showDog?: boolean; hideHomework?: boolean }) {
  const date = new Date(s.occurred_at)
  const canDelete = useCan()('delete_sessions')
  const del = useDeleteSession()
  // `?? []` guards against session data cached before homework existed (e.g. across a hot reload).
  const homework = hideHomework ? [] : (s.homework_tasks ?? [])
  // Has something for the owner that hasn't gone out in a profile link yet.
  const { data: unsentList } = useUnsentSessions()
  const unsent = !!unsentList?.some((u) => u.id === s.id)
  const regressions = s.stage_events.filter((e) => e.from_status && statusRank[e.from_status] > statusRank[e.to_status])

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {showDog && s.dogs && (
            <Link to={`/dogs/${s.dogs.id}`} className="font-semibold hover:underline">{s.dogs.name}</Link>
          )}
          <div className={showDog ? 'text-sm' : 'font-semibold'}>
            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            <span className="font-normal text-neutral-500"> · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <div className="text-xs text-neutral-500">
            {s.staff?.display_name ?? 'Former staff'}
            {s.package_id && ' · package session'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {unsent && s.dogs && (
            <ShareProfileButton
              householdId={s.dogs.household_id}
              dogId={s.dog_id}
              label="Not sent · Send"
              className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 hover:underline disabled:opacity-50"
            />
          )}
          {s.takes_food != null && (
            <span className={`rounded-full px-2 py-0.5 ${s.takes_food ? 'bg-neutral-100' : 'bg-amber-100 text-amber-900'}`}>
              {s.takes_food ? 'Took food' : 'Not taking food'}
            </span>
          )}
          {s.rating != null && (
            <span aria-label={`Rating ${s.rating} of 5`} className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`size-2 rounded-full ${n <= s.rating! ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
              ))}
            </span>
          )}
        </div>
      </div>

      {s.flags.map((f) => (
        <div key={f.id} className={`rounded-lg p-2 text-sm ${f.resolved_at ? 'bg-neutral-100 text-neutral-600' : 'border border-flag bg-flag-soft'}`}>
          <strong className={f.resolved_at ? '' : 'text-flag'}>⚑ Flag raised ({f.severity})</strong>
          {f.resolved_at && ' · resolved'}: {f.note}
        </div>
      ))}

      {s.session_behaviors.length > 0 && (
        <ul className="flex flex-col gap-1">
          {s.session_behaviors.map((b) => {
            const measures = (b.measures ?? {}) as Measures
            const parts = MEASURE_FIELDS.filter((f) => measures[f.key]).map((f) => formatMeasure(f.key, measures[f.key]!))
            return (
              <li key={b.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">{b.behavior_tags?.label}</span>
                {parts.length > 0 && <span className="text-neutral-600">{parts.join(' · ')}</span>}
                {b.note && <span className="basis-full pl-2 text-neutral-600">{b.note}</span>}
              </li>
            )
          })}
        </ul>
      )}

      {s.stage_events.length > 0 && (
        <ul className="text-sm">
          {s.stage_events.map((e) => (
            <li key={e.id} className={regressions.includes(e) ? 'text-amber-800' : 'text-neutral-700'}>
              {regressions.includes(e) ? '↩︎' : '→'} {e.plan_stages?.name}: {statusLabel[e.to_status]}
              {e.reason && <span className="text-neutral-500"> ({e.reason})</span>}
            </li>
          ))}
        </ul>
      )}

      {s.external_notes && (
        <div className="text-sm">
          <div className="text-xs font-medium tracking-wide text-neutral-500 uppercase">For owner</div>
          <p className="whitespace-pre-wrap">{s.external_notes}</p>
        </div>
      )}
      {homework.length > 0 && (
        <div className="text-sm">
          <div className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Homework</div>
          <ul>
            {homework.map((t) => (
              <li key={t.id} className={t.completed_at ? 'text-neutral-500 line-through' : ''}>
                {t.completed_at ? '☑' : '☐'} {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.internal_notes && (
        <div className="rounded-lg bg-neutral-100 p-2 text-sm">
          <div className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Internal</div>
          <p className="whitespace-pre-wrap">{s.internal_notes}</p>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 text-sm">
        {del.error && <span className="text-flag">{del.error.message}</span>}
        <Link to={`/dogs/${s.dog_id}/sessions/${s.id}/edit`} className={actionClass}>
          Edit
        </Link>
        {canDelete && (
          <button
            className={actionClass}
            disabled={del.isPending}
            onClick={() =>
              confirm(`Delete this session from ${date.toLocaleDateString()}${s.homework_tasks?.length ? ` and its ${s.homework_tasks.length} homework task(s)` : ''}? This can't be undone.`) &&
              del.mutate(s.id)
            }
          >
            Delete session
          </button>
        )}
      </div>
    </Card>
  )
}
