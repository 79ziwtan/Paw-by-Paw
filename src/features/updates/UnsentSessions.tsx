import { Link } from 'react-router'
import { Card } from '../../components/ui'
import { useUnsentSessions, type UnsentSession } from './api'
import { ShareProfileButton } from './ShareProfileButton'

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Updates → "Not sent yet": sessions with owner notes or homework logged since the household's
 * last profile link. Send opens a fresh profile link (all of that owner's dogs) in a new tab.
 */
export function UnsentSessions() {
  const { data, isPending, error } = useUnsentSessions()
  if (isPending || !data?.length) return error ? <p className="text-sm text-flag">{error.message}</p> : null

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-semibold">
        Not sent yet
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{data.length}</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {data.map((s) => (
          <li key={s.id}>
            <UnsentCard session={s} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function UnsentCard({ session: s }: { session: UnsentSession }) {
  return (
    <Card className="flex flex-col gap-3 border-amber-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/dogs/${s.dog_id}`} className="font-semibold hover:underline">{s.dog_name}</Link>
          <span className="text-neutral-500"> · {s.owner_name}</span>
          <div className="text-xs text-neutral-500">
            Session {s.occurred_at && when(s.occurred_at)}
            {s.trainer_name && ` · ${s.trainer_name}`}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Not sent</span>
          {s.household_id && <ShareProfileButton householdId={s.household_id} dogId={s.dog_id} />}
        </div>
      </div>

      {s.external_notes && <p className="text-sm">{s.external_notes}</p>}

      {s.homework.length > 0 && (
        <div className="text-sm">
          <div className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Homework ({s.homework.length})</div>
          <ul>
            {s.homework.map((t) => (
              <li key={t.id} className={t.completed_at ? 'text-neutral-500 line-through' : ''}>
                {t.completed_at ? '☑' : '☐'} {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
