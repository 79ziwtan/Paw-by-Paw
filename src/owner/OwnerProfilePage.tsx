import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { supabase } from '../lib/supabase'

type Stage = { name: string; status: 'not_started' | 'in_progress' | 'complete' }
type Task = { id: string; text: string; done: boolean }
type Session = { id: string; occurred_at: string; notes: string; trainer: string | null; homework: Task[] }
type Dog = { id: string; name: string; stages: Stage[]; pending: { id: string; text: string; assigned_at: string }[]; sessions: Session[] }
type Profile =
  | { status: 'not_found' | 'expired' }
  | { status: 'ok'; business_name: string; owner_first_name: string; expires_at: string; focus_dog_id: string | null; dogs: Dog[] }

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** Public, no-login owner profile: every dog in the household, last notes, homework to do, history. */
export function OwnerProfilePage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const key = ['owner_profile', token]

  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_owner_profile', { token })
      if (error) throw error
      return data as unknown as Profile
    },
  })

  // Tick/untick homework. Optimistic: flip it in pending and in history right away.
  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.rpc('set_profile_homework', { token, task_id: id, done })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  const [done, setDone] = useState<Record<string, boolean>>({})
  const isDone = (id: string, fallback: boolean) => done[id] ?? fallback
  const tick = (id: string, value: boolean) => {
    setDone({ ...done, [id]: value })
    toggle.mutate({ id, done: value })
  }

  if (isPending) return <p className="p-6 text-neutral-500">Loading…</p>

  if (!data || data.status !== 'ok') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-4 text-center">
        <h1 className="text-xl font-semibold">{data?.status === 'expired' ? 'This link has expired.' : 'Link not found.'}</h1>
        <p className="text-neutral-600">For privacy, these links only last 14 days. Ask your trainer for a new one.</p>
      </main>
    )
  }

  // Opened from a session for one dog: show that dog first, the rest collapsed below.
  const focus = data.dogs.find((d) => d.id === data.focus_dog_id) ?? null
  const others = focus ? data.dogs.filter((d) => d.id !== focus.id) : []

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4">
      <header>
        <p className="text-sm text-neutral-500">{data.business_name}</p>
        <h1 className="text-2xl font-semibold">Hi {data.owner_first_name}</h1>
        <p className="text-sm text-neutral-500">
          {focus ? `Here's ${focus.name}'s latest.` : `Here's where ${data.dogs.length === 1 ? `${data.dogs[0].name} is` : 'your dogs are'} at.`}
        </p>
      </header>

      {data.dogs.length === 0 && <p className="text-neutral-500">No dogs to show yet.</p>}

      {focus ? (
        <>
          <DogSection dog={focus} isDone={isDone} tick={tick} />
          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-neutral-500">Your other {others.length === 1 ? 'dog' : 'dogs'}</h2>
              {others.map((d) => (
                <details key={d.id} className="group rounded-2xl border border-neutral-400 bg-white shadow-sm">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="font-semibold">🐾 {d.name}</span>
                      <span className="text-sm text-neutral-500">
                        {d.stages.find((st) => st.status === 'in_progress') && ` · ${d.stages.find((st) => st.status === 'in_progress')!.name}`}
                        {d.pending.length > 0 && ` · ${d.pending.length} to do`}
                      </span>
                    </span>
                    <span className="text-neutral-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
                  </summary>
                  <div className="border-t border-neutral-100">
                    <DogSection dog={d} isDone={isDone} tick={tick} bare />
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      ) : (
        data.dogs.map((d) => <DogSection key={d.id} dog={d} isDone={isDone} tick={tick} />)
      )}

      <p className="text-center text-xs text-neutral-400">
        No app or login needed · link works until {new Date(data.expires_at).toLocaleDateString()}
      </p>
    </main>
  )
}

/** One dog: plan, last meeting notes, homework to do, history. `bare` = no card/title (inside a collapsed row). */
function DogSection({ dog: d, isDone, tick, bare = false }: {
  dog: Dog
  isDone: (id: string, fallback: boolean) => boolean
  tick: (id: string, value: boolean) => void
  bare?: boolean
}) {
  const [last, ...history] = d.sessions
  return (
    <section className={bare ? 'flex flex-col gap-4 p-4' : 'flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4'}>
      {!bare && <h2 className="text-xl font-semibold">🐾 {d.name}</h2>}

      {d.stages.length > 0 && (
        <ol className="flex flex-wrap gap-1" aria-label="Training plan">
          {d.stages.map((s) => (
            <li
              key={s.name}
              className={`rounded-full px-2.5 py-1 text-xs ${s.status === 'in_progress' ? 'bg-neutral-900 text-white' : s.status === 'complete' ? 'bg-neutral-300' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {s.status === 'complete' && '✓ '}
              {s.name}
            </li>
          ))}
        </ol>
      )}

      <div>
        <h3 className="mb-1 font-semibold">Last meeting</h3>
        {last ? (
          <>
            <p className="text-xs text-neutral-500">{day(last.occurred_at)}{last.trainer && ` · ${last.trainer}`}</p>
            {last.notes ? <p className="mt-1 whitespace-pre-wrap">{last.notes}</p> : <p className="mt-1 text-sm text-neutral-500">Homework only, see below.</p>}
          </>
        ) : (
          <p className="text-sm text-neutral-500">No notes yet.</p>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">To do {d.pending.length > 0 && <span className="font-normal text-neutral-500">({d.pending.length})</span>}</h3>
        {d.pending.length === 0 ? (
          <p className="text-sm text-neutral-500">All caught up 🎉</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.pending.map((t) => (
              <li key={t.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3">
                  <input type="checkbox" className="size-5" checked={isDone(t.id, false)} onChange={(e) => tick(t.id, e.target.checked)} />
                  <span className={isDone(t.id, false) ? 'text-neutral-400 line-through' : ''}>{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <details className="group rounded-lg border border-neutral-400 shadow-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
            History ({history.length})
            <span className="text-neutral-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <ol className="mx-3 mb-3 mt-1 flex flex-col gap-3 border-l-2 border-neutral-200 pl-3">
            {history.map((s) => (
              <li key={s.id} className="text-sm">
                <div className="text-xs text-neutral-500">{day(s.occurred_at)}{s.trainer && ` · ${s.trainer}`}</div>
                {s.notes && <p className="whitespace-pre-wrap">{s.notes}</p>}
                {s.homework.length > 0 && (
                  <ul className="mt-1 text-neutral-600">
                    {s.homework.map((h) => (
                      <li key={h.id} className={isDone(h.id, h.done) ? 'text-neutral-400 line-through' : ''}>
                        {isDone(h.id, h.done) ? '☑' : '☐'} {h.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}
