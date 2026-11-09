import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui'
import { ActivityFeed } from '../activity/ActivityFeed'
import { useAuth } from '../auth/AuthProvider'
import { useSentItems } from './api'
import { ShareProfileButton } from './ShareProfileButton'
import { UnsentSessions } from './UnsentSessions'

/** Owner updates for everyone; owners and admins also get the Activity log (adds, changes, deletes). */
export function UpdatesPage() {
  const { staff } = useAuth()
  const canSeeActivity = staff?.role === 'owner' || staff?.role === 'admin'
  const [tab, setTab] = useState<'owner' | 'activity'>('owner')

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Updates</h1>
      {canSeeActivity && (
        <div role="tablist" className="flex rounded-md bg-neutral-100 p-1">
          {([['owner', 'Owner updates'], ['activity', 'Activity']] as const).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-10 flex-1 rounded-md text-sm font-medium ${tab === t ? 'bg-white' : 'text-neutral-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {canSeeActivity && tab === 'activity' ? <ActivityFeed /> : <OwnerUpdates />}
    </section>
  )
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Not sent yet, then everything already sent (newest first). */
function OwnerUpdates() {
  const { data: sent, isPending, error } = useSentItems()

  return (
    <div className="flex flex-col gap-4">
      <UnsentSessions />
      <header>
        <h2 className="font-semibold">Sent</h2>
        <p className="text-sm text-neutral-500">Newest first. A profile link shows all of that owner's dogs and lasts 14 days.</p>
      </header>
      {isPending && <p className="text-neutral-500">Loading…</p>}
      {error && <p className="text-flag">{error.message}</p>}
      {sent?.length === 0 && <Card className="border-dashed text-center text-sm text-neutral-500">Nothing sent yet. Use Send on a session above.</Card>}
      <ul className="flex flex-col gap-2">
        {sent?.map((item) => (
          <li key={item.id}>
            <Card className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link to={`/households/${item.householdId}`} className="font-semibold hover:underline">{item.ownerName}</Link>
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {item.kind === 'profile' ? 'Profile link' : 'Session update'}{item.dogName && ` · ${item.dogName}`}
                </span>
                <div className="text-xs text-neutral-500">
                  Sent {day(item.sentAt)}
                  {item.sentBy && ` · ${item.sentBy}`}
                  {' · '}
                  {item.expired ? 'expired' : item.openedAt ? `opened ${day(item.openedAt)}` : 'not opened yet'}
                </div>
              </div>
              {item.householdId && (
                <ShareProfileButton
                  householdId={item.householdId}
                  dogId={item.dogId}
                  label="New link"
                  className="flex min-h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium disabled:opacity-50"
                />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
