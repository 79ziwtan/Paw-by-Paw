import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Button, Card, actionClass } from '../../components/ui'
import { formatAge } from '../../lib/format'
import { useCan } from '../auth/permissions'
import { useDeleteHousehold, useHousehold, useSetDogArchived } from './api'
import { HouseholdDetailsCard } from './HouseholdDetailsCard'
import { PackagesCard } from './PackagesCard'

export function HouseholdPage() {
  const { householdId = '' } = useParams()
  const navigate = useNavigate()
  const { data: h, isPending, error } = useHousehold(householdId)
  const setArchived = useSetDogArchived(householdId)
  const del = useDeleteHousehold()
  const [showArchived, setShowArchived] = useState(false)
  const can = useCan()
  const canDelete = can('delete_households')
  const canEditPackages = can('manage_packages')

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const active = h.dogs.filter((d) => !d.archived_at)
  const archived = h.dogs.filter((d) => d.archived_at)
  const pkg = h.packages[0]

  function removeDog(dogId: string, name: string) {
    if (confirm(`Remove ${name}? They'll be hidden from your lists, but their history is kept and you can restore them.`))
      setArchived.mutate({ dogId, archived: true })
  }

  async function deleteHousehold() {
    const ok = prompt(`This permanently deletes ${h!.owner_name}'s household, ${h!.dogs.length} dog(s), and all their sessions and history.\n\nType DELETE to confirm.`)
    if (ok !== 'DELETE') return
    await del.mutateAsync(householdId)
    navigate('/dogs', { replace: true })
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback="/dogs" fallbackLabel="Dogs" />
        <h1 className="text-xl font-semibold">Household</h1>
      </header>

      <HouseholdDetailsCard household={h} packageLine={pkg ? `${pkg.name}: ${pkg.sessions_used} of ${pkg.sessions_total} used` : 'No package'} />

      <PackagesCard householdId={householdId} packages={h.packages} canEdit={canEditPackages} />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Dogs</h2>
        <span className="text-sm text-neutral-500">{active.length} active</span>
      </div>

      {active.length === 0 && <p className="text-sm text-neutral-500">No dogs yet.</p>}
      <ul className="flex flex-col gap-2">
        {active.map((d) => (
          <li key={d.id}>
            <Card className="flex items-center gap-3">
              <Link to={`/dogs/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">🐾</div>
                <div className="min-w-0">
                  <div className="font-semibold">{d.name}</div>
                  <div className="truncate text-sm text-neutral-500">{[d.breed, formatAge(d.birth_date)].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              </Link>
              <button onClick={() => removeDog(d.id, d.name)} className="min-h-11 px-2 text-sm text-neutral-500 hover:text-neutral-900" disabled={setArchived.isPending}>
                Remove
              </button>
            </Card>
          </li>
        ))}
      </ul>

      <Link to={`/households/${householdId}/dogs/new`} className="rounded-lg border border-dashed border-neutral-400 py-3 text-center font-medium">
        + Add Another Dog
      </Link>

      {archived.length > 0 && (
        <div>
          <button className={actionClass} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} removed dogs ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 flex flex-col gap-2">
              {archived.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 text-sm">
                  <Link to={`/dogs/${d.id}`} className="text-neutral-600">{d.name}</Link>
                  <button className={actionClass} onClick={() => setArchived.mutate({ dogId: d.id, archived: false })}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canDelete && (
      <div className="mt-6 border-t border-neutral-200 pt-4">
        <Button variant="secondary" className="w-full text-flag" onClick={deleteHousehold} disabled={del.isPending}>
          Delete household
        </Button>
        {del.error && <p className="mt-2 text-sm text-flag">{del.error.message}</p>}
      </div>
      )}
    </section>
  )
}
