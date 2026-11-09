import { useState } from 'react'
import { inputClass } from '../../components/ui'
import type { Tables } from '../../lib/supabase'
import { useResolveFlag } from './api'

/** An active safety flag, pinned in red, with a Resolve action (optional note on what changed). */
export function SafetyFlag({ flag: f, readOnly = false }: { flag: Tables<'flags'>; readOnly?: boolean }) {
  const resolve = useResolveFlag(f.dog_id)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-flag bg-flag-soft p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p>
          <span className="font-semibold text-flag">Safety flag ({f.severity}):</span> {f.note}
        </p>
        {!readOnly && !open && (
          <button type="button" className="shrink-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs" onClick={() => setOpen(true)}>
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
          <input
            autoFocus
            className={inputClass}
            aria-label="What changed"
            placeholder="What changed? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={resolve.isPending} className="min-h-10 rounded-md border border-gold-500 bg-gold-400 px-3 text-sm font-medium disabled:opacity-50">
              {resolve.isPending ? 'Resolving…' : 'Resolve flag'}
            </button>
            <button type="button" className="min-h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {resolve.error && <p className="text-xs text-flag">{resolve.error.message}</p>}
        </form>
      )}
    </div>
  )
}
