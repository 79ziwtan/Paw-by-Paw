import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Card, Field, inputClass, actionClass, selectClass, dropdownClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { PERMISSIONS, useCan, type Permission } from '../auth/permissions'
import { useLocations } from '../households/api'
import { ROLE_INFO, useInviteStaff, useSetAdminPermissions, useSetDeactivated, useSetLocationAccess, useTeam, useUpdateRole, type StaffRole } from './api'

const roles = Object.keys(ROLE_INFO) as StaffRole[]
type Member = NonNullable<ReturnType<typeof useTeam>['data']>[number]

/**
 * Team members, roles, location access and admin permissions.
 * Owners: everything. Admins with manage_team: invite/remove trainers and set their access at
 * the admin's own locations. Admins with manage_admin_permissions: other admins' permissions,
 * limited to ones they hold. The database enforces all of this.
 */
export function TeamSection() {
  const { staff: me } = useAuth()
  const can = useCan()
  const isOwner = me?.role === 'owner'
  const canTeam = can('manage_team')
  const { data: team, isPending, error } = useTeam()
  const updateRole = useUpdateRole()
  const setDeactivated = useSetDeactivated()
  const setAccess = useSetLocationAccess()
  const setPerms = useSetAdminPermissions()
  const [showInvite, setShowInvite] = useState(false)
  const mutationError = updateRole.error ?? setDeactivated.error ?? setAccess.error ?? setPerms.error

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const myLocations = team.find((t) => t.id === me?.id)?.location_ids ?? []
  const active = team.filter((t) => !t.deactivated_at)
  const removed = team.filter((t) => t.deactivated_at)
  // Who may remove/restore this person.
  const canToggleActive = (t: Member) => t.id !== me?.id && (isOwner || (canTeam && t.role === 'trainer'))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{active.length} active {active.length === 1 ? 'member' : 'members'}</h2>
        {(isOwner || canTeam) && (
          <Button onClick={() => setShowInvite(!showInvite)} className="text-sm">{showInvite ? 'Close' : isOwner ? '+ Invite' : '+ Invite trainer'}</Button>
        )}
      </div>

      {showInvite && <InviteForm ownerMode={isOwner} myLocations={myLocations} onDone={() => setShowInvite(false)} />}
      {mutationError && <p className="rounded-md bg-flag-soft p-3 text-sm text-flag">{mutationError.message}</p>}

      <ul className="flex flex-col gap-3">
        {active.map((t) => (
          <li key={t.id}>
            <MemberCard
              member={t}
              isMe={t.id === me?.id}
              isOwner={isOwner}
              canTeam={canTeam}
              myLocations={myLocations}
              myPermissions={(me?.permissions ?? []) as Permission[]}
              canEditPermissions={can('manage_admin_permissions')}
              canRemove={canToggleActive(t)}
              updateRole={updateRole}
              setDeactivated={setDeactivated}
              setAccess={setAccess}
              setPerms={setPerms}
            />
          </li>
        ))}
      </ul>

      {removed.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">Removed</h2>
          <ul className="flex flex-col gap-2">
            {removed.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-1 text-sm">
                <span className="text-neutral-600">{t.display_name} · {t.email}</span>
                {canToggleActive(t) && (
                  <button className={actionClass} onClick={() => setDeactivated.mutate({ staffId: t.id, deactivated: false })}>Restore</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MemberCard({ member: t, isMe, isOwner, canTeam, myLocations, myPermissions, canEditPermissions, canRemove, updateRole, setDeactivated, setAccess, setPerms }: {
  member: Member
  isMe: boolean
  isOwner: boolean
  canTeam: boolean
  myLocations: string[]
  myPermissions: Permission[]
  canEditPermissions: boolean
  canRemove: boolean
  updateRole: ReturnType<typeof useUpdateRole>
  setDeactivated: ReturnType<typeof useSetDeactivated>
  setAccess: ReturnType<typeof useSetLocationAccess>
  setPerms: ReturnType<typeof useSetAdminPermissions>
}) {
  const { data: locations = [] } = useLocations()
  const perms = t.permissions as Permission[]
  // Location access: owners for anyone but owners; manage_team admins for trainers, at their own locations.
  const canSetLocation = (locationId: string) => isOwner || (canTeam && t.role === 'trainer' && myLocations.includes(locationId))
  // Permission toggles: owners for any admin; permitted admins for other admins, only permissions they hold.
  const canTogglePerm = (p: Permission) => t.role === 'admin' && (isOwner || (canEditPermissions && !isMe && myPermissions.includes(p)))

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{t.display_name}{isMe && <span className="font-normal text-neutral-500"> (you)</span>}</div>
          <div className="truncate text-sm text-neutral-500 select-text">{t.email}</div>
          <div className="text-xs text-neutral-400">
            {t.last_sign_in_at ? `Last active ${new Date(t.last_sign_in_at).toLocaleDateString()}` : 'Invite pending'}
          </div>
        </div>
        {isOwner ? (
          <select
            aria-label={`Role for ${t.display_name}`}
            className="cursor-pointer rounded-md border border-neutral-400 bg-white px-2 py-2 text-sm"
            value={t.role}
            disabled={updateRole.isPending}
            onChange={(e) => {
              const role = e.target.value as StaffRole
              if (isMe && role !== 'owner' && !confirm('Remove your own business-owner access? You will lose most of this Org tab.')) return
              updateRole.mutate({ staffId: t.id, role })
            }}
          >
            {roles.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
          </select>
        ) : (
          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium">{ROLE_INFO[t.role].label}</span>
        )}
      </div>
      <p className="text-xs text-neutral-500">{ROLE_INFO[t.role].description}</p>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Location access</legend>
        {t.role === 'owner' ? (
          <p className="text-sm text-neutral-500">All locations</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => {
              const on = t.location_ids.includes(l.id)
              const editable = canSetLocation(l.id)
              return (
                <label
                  key={l.id}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${on ? 'border-gold-500 bg-gold-400 text-neutral-900' : 'border-neutral-300'} ${editable ? 'cursor-pointer' : 'opacity-60'}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={!editable || setAccess.isPending}
                    onChange={(e) => setAccess.mutate({ staffId: t.id, locationId: l.id, allowed: e.target.checked })}
                  />
                  {on ? '✓ ' : ''}{l.name}
                </label>
              )
            })}
            {t.location_ids.length === 0 && <p className="w-full text-xs text-flag">No locations — this person can't see any clients.</p>}
          </div>
        )}
      </fieldset>

      {t.role === 'admin' && (
        <details className={dropdownClass}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
            <span className="font-medium">
              Permissions <span className="font-normal text-neutral-500">({perms.length} of {PERMISSIONS.length})</span>
              {isMe && !isOwner && <span className="font-normal text-neutral-500"> · only someone else can change yours</span>}
            </span>
            <span className="text-neutral-400 group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <ul className="flex flex-col gap-1 border-t border-neutral-200 px-3 py-2">
            {PERMISSIONS.map(({ key, label }) => {
              const on = perms.includes(key)
              const editable = canTogglePerm(key)
              return (
                <li key={key}>
                  <label className={`flex min-h-10 items-center gap-3 text-sm ${editable ? 'cursor-pointer' : 'text-neutral-500'}`}>
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={on}
                      disabled={!editable || setPerms.isPending}
                      onChange={(e) =>
                        setPerms.mutate({ staffId: t.id, permissions: e.target.checked ? [...perms, key] : perms.filter((p) => p !== key) })
                      }
                    />
                    {label}
                  </label>
                </li>
              )
            })}
          </ul>
          {!isOwner && !isMe && canEditPermissions && (
            <p className="px-3 pb-2 text-xs text-neutral-500">You can only change permissions you have yourself.</p>
          )}
        </details>
      )}

      {canRemove && (
        <button
          className={`${actionClass} self-start`}
          onClick={() => confirm(`Remove ${t.display_name}'s access? Their past sessions keep their name, and you can restore them later.`) &&
            setDeactivated.mutate({ staffId: t.id, deactivated: true })}
        >
          Remove access
        </button>
      )}
    </Card>
  )
}

function InviteForm({ ownerMode, myLocations, onDone }: { ownerMode: boolean; myLocations: string[]; onDone: () => void }) {
  const { data: allLocations = [] } = useLocations()
  const locations = ownerMode ? allLocations : allLocations.filter((l) => myLocations.includes(l.id))
  const invite = useInviteStaff()
  const [form, setForm] = useState({ email: '', display_name: '', role: 'trainer' as StaffRole })
  const [locationIds, setLocationIds] = useState<string[] | null>(null)
  const selected = locationIds ?? (locations.length === 1 ? [locations[0].id] : [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    await invite.mutateAsync({ ...form, location_ids: form.role === 'owner' ? [] : selected })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Name">
          <input className={inputClass} required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        {ownerMode ? (
          <Field label="Role">
            <select className={selectClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
            </select>
            <span className="text-xs font-normal text-neutral-500">{ROLE_INFO[form.role].description}</span>
          </Field>
        ) : (
          <p className="text-sm text-neutral-500">They'll join as a trainer. Only the business owner can add admins or owners.</p>
        )}
        {form.role !== 'owner' && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-700">Locations</legend>
            {locations.map((l) => (
              <label key={l.id} className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  onChange={(e) => setLocationIds(e.target.checked ? [...selected, l.id] : selected.filter((id) => id !== l.id))}
                />
                {l.name}
              </label>
            ))}
            {ownerMode && <Link to="../business" className={actionClass}>Manage locations</Link>}
          </fieldset>
        )}
        {invite.error && <p className="text-sm text-flag">{invite.error.message}</p>}
        <Button type="submit" disabled={invite.isPending}>{invite.isPending ? 'Sending…' : 'Send invite'}</Button>
        <p className="text-xs text-neutral-500">They'll get an email to set a password and join.</p>
      </form>
    </Card>
  )
}
