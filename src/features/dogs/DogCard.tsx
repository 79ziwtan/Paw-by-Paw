import { Link } from 'react-router'
import { Card, FlagBadge, PaymentDot } from '../../components/ui'
import type { Views } from '../../lib/supabase'
import { useLocationName } from '../households/api'

export function DogCard({ dog }: { dog: Views<'dog_summary'> }) {
  const location = useLocationName()(dog.location_id)
  return (
    <Link to={`/dogs/${dog.id}`}>
      <Card className="flex items-center gap-3 hover:border-neutral-400">
        <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">🐾</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{dog.name}</span>
            <PaymentDot status={dog.payment_status} />
            <FlagBadge count={dog.active_flags} />
          </div>
          <div className="truncate text-sm text-neutral-500">
            {dog.owner_name}
            {location && <> · 📍 {location}</>}
          </div>
          {dog.current_stage && (
            <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{dog.current_stage}</span>
          )}
        </div>
        <span className="text-neutral-400">›</span>
      </Card>
    </Link>
  )
}
