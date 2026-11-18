import { Link } from 'react-router'
import { CalendarIcon, ClockIcon, Eyebrow } from '../../components/ui'
import { timeLabel, useNextAppointment } from '../calendar/api'

const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Handoff strip for a trainer taking over a dog: who trained it last and when, and the next
 * booked appointment. Used on the dog summary card and the dog profile.
 */
export function TrainerHandoff({ dogId, last, canBook = true }: {
  dogId: string
  /** The dog's most recent session, from dog_summary.last_sessions[0]. */
  last: { occurred_at: string; trainer?: string | null } | undefined
  canBook?: boolean
}) {
  const { data: next, isPending } = useNextAppointment(dogId)
  const lastAt = last ? new Date(last.occurred_at) : null
  const nextAt = next ? new Date(next.starts_at) : null

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
      <div className="flex items-start gap-3 bg-white p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          <ClockIcon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <Eyebrow>Last trained</Eyebrow>
          {lastAt ? (
            <p className="text-sm">
              by <b>{last?.trainer ?? 'former staff'}</b> on <b>{dayLabel(lastAt)}</b>
            </p>
          ) : (
            <p className="text-sm text-neutral-500">No sessions logged yet</p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-white p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-800">
          <CalendarIcon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <Eyebrow>Next appointment</Eyebrow>
          {isPending ? (
            <p className="text-sm text-neutral-400">…</p>
          ) : nextAt && next ? (
            <Link to={`/dogs/${dogId}/summary?appointment=${next.id}`} className="block text-sm hover:underline">
              <b>{dayLabel(nextAt)} · {timeLabel(nextAt)}</b> with <b>{next.trainer?.display_name ?? 'no trainer yet'}</b>
              {next.location && <span className="text-neutral-500"> · {next.location}</span>}
            </Link>
          ) : (
            <p className="text-sm text-neutral-500">
              Nothing booked
              {canBook && (
                <>
                  {' · '}
                  <Link to={`/appointments/new?dog=${dogId}`} className="font-semibold text-gold-700 hover:underline">Book one</Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
