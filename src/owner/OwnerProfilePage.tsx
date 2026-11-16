import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { DogAvatar, Logo, PageLoader, StageBars } from '../components/ui'
import { publicSupabase as supabase } from '../lib/publicSupabase'

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

  if (isPending) return <PageLoader full />

  if (!data || data.status !== 'ok') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-4 text-center">
        <h1 className="text-2xl font-bold">{data?.status === 'expired' ? 'This link has expired.' : 'Link not found.'}</h1>
        <p className="text-neutral-600">For privacy, these links only last 14 days. Ask your trainer for a new one.</p>
      </main>
    )
  }

  // Opened from a session for one dog: show that dog first, the rest collapsed below.
  const focus = data.dogs.find((d) => d.id === data.focus_dog_id) ?? null
  const others = focus ? data.dogs.filter((d) => d.id !== focus.id) : []

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <header className="flex flex-col gap-1 pt-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-500"><Logo size={20} /> {data.business_name}</p>
        <h1 className="mt-2 text-4xl font-bold">Hi {data.owner_first_name}</h1>
        <p className="text-neutral-600">
          {focus ? `Here's ${focus.name}'s latest.` : `Here's where ${data.dogs.length === 1 ? `${data.dogs[0].name} is` : 'your dogs are'} at.`}
        </p>
      </header>

      {data.dogs.length === 0 && <p className="text-neutral-500">No dogs to show yet.</p>}

      {focus ? (
        <>
          <DogSection dog={focus} isDone={isDone} tick={tick} />
          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-bold">Your other {others.length === 1 ? 'dog' : 'dogs'}</h2>
              {others.map((d) => (
                <details key={d.id} className="group rounded-2xl border border-neutral-200 bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="font-bold">{d.name}</span>
                      <span className="text-sm text-neutral-500">
                        {d.stages.find((st) => st.status === 'in_progress') && ` · ${d.stages.find((st) => st.status === 'in_progress')!.name}`}
                        {d.pending.length > 0 && ` · ${d.pending.length} to do`}
                      </span>
                    </span>
                    <span className="text-neutral-400 group-open:rotate-180" aria-hidden>▾</span>
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
    <section className={bare ? 'flex flex-col gap-4 p-4' : 'flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-5'}>
      {!bare && (
        <div className="flex items-center gap-3">
          <DogAvatar name={d.name} />
          <h2 className="font-display text-2xl font-bold">{d.name}</h2>
        </div>
      )}

      {d.stages.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.1em] text-neutral-500 uppercase">
            Plan · {d.stages.find((s) => s.status === 'in_progress')?.name ?? `${d.stages.filter((s) => s.status === 'complete').length} of ${d.stages.length} done`}
          </div>
          <StageBars stages={d.stages} />
          <ol className="sr-only" aria-label="Training plan">
            {d.stages.map((s) => <li key={s.name}>{s.name}: {s.status.replace('_', ' ')}</li>)}
          </ol>
        </div>
      )}

      <div>
        <h3 className="mb-1.5 font-display text-lg font-bold">Last lesson</h3>
        {last ? (
          <div className="rounded-2xl bg-neutral-50 p-3.5">
            <p className="text-xs font-semibold text-neutral-500">{day(last.occurred_at)}{last.trainer && ` · with ${last.trainer}`}</p>
            {last.notes ? <p className="mt-1 whitespace-pre-wrap">{last.notes}</p> : <p className="mt-1 text-sm text-neutral-500">Homework only, see below.</p>}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No notes yet.</p>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-display text-lg font-bold">Homework {d.pending.length > 0 && <span className="font-sans text-sm font-normal text-neutral-500">· {d.pending.length} to do</span>}</h3>
        {d.pending.length === 0 ? (
          <p className="text-sm text-neutral-500">All caught up.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.pending.map((t) => (
              <li key={t.id}>
                <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 transition-colors ${isDone(t.id, false) ? 'border-gold-200 bg-gold-50' : 'border-neutral-200 bg-white'}`}>
                  <input
                    type="checkbox"
                    className="size-6 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-neutral-300 bg-white bg-center bg-no-repeat checked:border-gold-500 checked:bg-gold-400 checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%231f1a14%22%20stroke-width=%223%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22m6%2012.5%204%204L18%208%22/%3E%3C/svg%3E')]"
                    checked={isDone(t.id, false)}
                    onChange={(e) => tick(t.id, e.target.checked)}
                  />
                  <span className={isDone(t.id, false) ? 'text-neutral-400 line-through' : ''}>{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <details className="group rounded-2xl border border-neutral-200">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
            History ({history.length})
            <span className="text-neutral-400 group-open:rotate-180" aria-hidden>▾</span>
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
