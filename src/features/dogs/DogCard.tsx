import { Link } from 'react-router'
import { ChevronRight, FlagBadge, PaymentDot, Pill } from '../../components/ui'
import { DogPhoto } from './photos'
import type { Views } from '../../lib/supabase'
import { useLocationName } from '../households/api'

export function DogCard({ dog }: { dog: Views<'dog_summary'> }) {
  const location = useLocationName()(dog.location_id)
  return (
    <Link
      to={`/dogs/${dog.id}`}
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 transition hover:-translate-y-px hover:shadow-[0_12px_30px_-18px_rgba(100,61,20,.45)]"
    >
      <DogPhoto name={dog.name} photoPath={dog.photo_path} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{dog.name}</span>
          <PaymentDot status={dog.payment_status} />
          <FlagBadge count={dog.active_flags} />
        </div>
        <div className="truncate text-sm text-neutral-500">
          {dog.owner_name}
          {location && <> · {location}</>}
        </div>
        {dog.current_stage && <div className="mt-1.5"><Pill>{dog.current_stage}</Pill></div>}
      </div>
      <ChevronRight className="size-5 shrink-0 text-neutral-300" />
    </Link>
  )
}
