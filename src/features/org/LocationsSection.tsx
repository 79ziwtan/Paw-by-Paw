import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Card, PaymentDot, inputClass, actionClass } from '../../components/ui'
import { ROLE_INFO, useAddLocation, useDeleteLocation, useLocationClients, useLocationsWithCounts, useTeam, useUpdateLocation } from './api'

export function LocationsSection() {
  const { data: locations, isPending, error } = useLocationsWithCounts()
  const add = useAddLocation()
  const update = useUpdateLocation()
  const del = useDeleteLocation()
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', city: '' })
  const [newLoc, setNewLoc] = useState({ name: '', city: '' })
  const mutationError = add.error ?? update.error ?? del.error

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  async function addLocation(e: FormEvent) {
    e.preventDefault()
    await add.mutateAsync({ name: newLoc.name.trim(), city: newLoc.city.trim() })
    setNewLoc({ name: '', city: '' })
  }

  async function saveEdit(e: FormEvent, id: string) {
    e.preventDefault()
    await update.mutateAsync({ id, name: draft.name.trim(), city: draft.city.trim() || null })
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Each household belongs to one location. Trainers and admins only see clients at the locations you give them in Team.
      </p>
      {mutationError && <p className="rounded-md bg-flag-soft p-3 text-sm text-flag">{mutationError.message}</p>}

      <ul className="flex flex-col gap-2">
        {locations.map((l) => (
          <li key={l.id}>
            <Card>
              {editing === l.id ? (
                <form onSubmit={(e) => saveEdit(e, l.id)} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input className={inputClass} aria-label="Name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
                    <input className={inputClass} aria-label="City" placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={update.isPending}>Save</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={open === l.id}
                    onClick={() => setOpen(open === l.id ? null : l.id)}
                  >
                    <div className="font-semibold">{l.name} <span className="text-sm font-normal text-neutral-400">{open === l.id ? '▴' : '▾'}</span></div>
                    <div className="text-sm text-neutral-500">
                      {[l.city, `${l.householdCount} ${l.householdCount === 1 ? 'client' : 'clients'}`, `${l.staffCount} staff`].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                  <div className="flex">
                    <button className={actionClass} onClick={() => { setEditing(l.id); setDraft({ name: l.name, city: l.city ?? '' }) }}>
                      Edit
                    </button>
                    <button
                      className={actionClass}
                      disabled={locations.length === 1 || del.isPending}
                      title={locations.length === 1 ? 'A business needs at least one location' : undefined}
                      onClick={() => {
                        if (l.householdCount > 0) return alert(`${l.name} still has ${l.householdCount} client(s). Move or delete them first.`)
                        if (confirm(`Delete ${l.name}?`)) del.mutate(l.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {open === l.id && <LocationPeople locationId={l.id} />}
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <form onSubmit={addLocation} className="flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} placeholder="New location name" required value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} />
        <input className={inputClass} placeholder="City (optional)" value={newLoc.city} onChange={(e) => setNewLoc({ ...newLoc, city: e.target.value })} />
        <Button type="submit" variant="secondary" disabled={add.isPending}>Add location</Button>
      </form>
    </div>
  )
}

/** Who's tied to a location: business owners (they see every location), staff given access, and clients. */
function LocationPeople({ locationId }: { locationId: string }) {
  const team = useTeam()
  const clients = useLocationClients(locationId)
  const members = (team.data ?? [])
    .filter((t) => t.role === 'owner' || t.location_ids.includes(locationId))
    .sort((a, b) => Number(!!a.deactivated_at) - Number(!!b.deactivated_at) || a.display_name.localeCompare(b.display_name))

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-neutral-100 pt-3 text-sm">
      <div>
        <h3 className="mb-1.5 font-semibold">Team ({members.filter((m) => !m.deactivated_at).length})</h3>
        {team.isPending && <p className="text-neutral-500">Loading…</p>}
        {team.error && <p className="text-flag">{team.error.message}</p>}
        {team.data && members.length === 0 && <p className="text-neutral-500">Nobody has access yet. Give access in Team.</p>}
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.id} className={`flex items-center justify-between gap-2 ${m.deactivated_at ? 'text-neutral-400' : ''}`}>
              <span>
                {m.display_name}
                <span className="text-neutral-500"> · {m.email}</span>
              </span>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                {m.deactivated_at ? 'Removed' : ROLE_INFO[m.role].label}
                {m.role === 'owner' && !m.deactivated_at && ' · all locations'}
              </span>
            </li>
          ))}
        </ul>
        <Link to="/org/team" className={`${actionClass} mt-2`}>Manage access in Team</Link>
      </div>

      <div>
        <h3 className="mb-1.5 font-semibold">Clients ({clients.data?.length ?? '…'})</h3>
        {clients.error && <p className="text-flag">{clients.error.message}</p>}
        {clients.data?.length === 0 && <p className="text-neutral-500">No clients at this location.</p>}
        <ul className="flex flex-col gap-1">
          {clients.data?.map((h) => (
            <li key={h.id}>
              <Link to={`/households/${h.id}`} className="flex min-h-9 items-center justify-between gap-2 hover:underline">
                <span className="flex items-center gap-2">
                  <PaymentDot status={h.payment_status} />
                  {h.owner_name}
                </span>
                <span className="text-neutral-500">{h.dogCount} {h.dogCount === 1 ? 'dog' : 'dogs'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
