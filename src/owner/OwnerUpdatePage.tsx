import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { supabase } from '../lib/supabase'

type OwnerUpdate =
  | { status: 'not_found' | 'expired' }
  | {
      status: 'ok'
      dog_name: string
      trainer_name: string | null
      sent_at: string | null
      worked_on: string
      plan_progress: string
      stages: { name: string; status: 'not_started' | 'in_progress' | 'complete' }[]
      homework: { id: string; text: string; done: boolean }[]
    }

/** Flow C: public page, no login. All access goes through token-checked RPCs. */
export function OwnerUpdatePage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const key = ['owner_update', token]

  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_owner_update', { token })
      if (error) throw error
      return data as unknown as OwnerUpdate
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.rpc('set_homework', { token, task_id: id, done })
      if (error) throw error
    },
    onMutate: ({ id, done }) =>
      qc.setQueryData<OwnerUpdate>(key, (old) =>
        old?.status === 'ok' ? { ...old, homework: old.homework.map((h) => (h.id === id ? { ...h, done } : h)) } : old,
      ),
    onError: () => qc.invalidateQueries({ queryKey: key }),
  })

  const requestLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('request_new_link', { token })
      if (error) throw error
    },
  })

  if (isPending) return <p className="p-6 text-neutral-500">Loading…</p>

  if (!data || data.status !== 'ok') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-xl font-semibold">This link has expired.</h1>
        <p className="text-neutral-600">For privacy, owner update links are available for a limited time.</p>
        {data?.status === 'expired' &&
          (requestLink.isSuccess ? (
            <p className="text-sm">Your trainer has been notified.</p>
          ) : (
            <button onClick={() => requestLink.mutate()} className="min-h-11 rounded-lg bg-neutral-900 px-4 font-medium text-white">
              Request New Link
            </button>
          ))}
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-4">
      <header>
        <h1 className="text-2xl font-semibold">{data.dog_name}'s update</h1>
        <p className="text-sm text-neutral-500">
          From {data.trainer_name ?? 'your trainer'}
          {data.sent_at && ` · ${new Date(data.sent_at).toLocaleDateString()}`}
        </p>
      </header>
      <section>
        <h2 className="mb-1 font-semibold">What we worked on</h2>
        <p>{data.worked_on}</p>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Plan progress</h2>
        <ol className="flex flex-wrap gap-1">
          {data.stages.map((s) => (
            <li
              key={s.name}
              className={`rounded-full px-2.5 py-1 text-xs ${s.status === 'in_progress' ? 'bg-neutral-900 text-white' : s.status === 'complete' ? 'bg-neutral-300' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {s.status === 'complete' && '✓ '}
              {s.name}
            </li>
          ))}
        </ol>
        {data.plan_progress && <p className="mt-2 text-sm">{data.plan_progress}</p>}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Homework</h2>
        <ul className="flex flex-col gap-2">
          {data.homework.map((h) => (
            <li key={h.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3">
                <input type="checkbox" className="size-5" checked={h.done} onChange={(e) => toggle.mutate({ id: h.id, done: e.target.checked })} />
                <span className={h.done ? 'text-neutral-400 line-through' : ''}>{h.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-center text-xs text-neutral-400">No app or login required.</p>
    </main>
  )
}
