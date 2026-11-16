import { useState } from 'react'
import { Button, FlagIcon, inputClass } from '../../components/ui'
import type { Tables } from '../../lib/supabase'
import { useResolveFlag } from './api'

/** An active safety flag, pinned in red, with a Resolve action (optional note on what changed). */
export function SafetyFlag({ flag: f, readOnly = false }: { flag: Tables<'flags'>; readOnly?: boolean }) {
  const resolve = useResolveFlag(f.dog_id)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-flag-soft p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-flag text-white">
          <FlagIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-[11px] font-bold tracking-[0.1em] text-flag uppercase">Safety · {f.severity}</div>
          <p className="font-medium text-neutral-900">{f.note}</p>
        </div>
        {!readOnly && !open && (
          <button type="button" className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-red-200 hover:bg-red-50" onClick={() => setOpen(true)}>
            Resolve
          </button>
        )}
      </div>
      {open && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            resolve.mutate({ flagId: f.id, note })
          }}
        >
          <input autoFocus className={inputClass} aria-label="What changed" placeholder="What changed? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" className="min-h-10 text-sm" disabled={resolve.isPending}>{resolve.isPending ? 'Resolving…' : 'Resolve flag'}</Button>
            <Button type="button" variant="secondary" className="min-h-10 text-sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {resolve.error && <p className="text-xs text-flag">{resolve.error.message}</p>}
        </form>
      )}
    </div>
  )
}
