import { useState, type FormEvent } from 'react'
import { Button, inputClass } from '../../components/ui'
import { useCan } from '../auth/permissions'
import { TemplatesSection } from '../plans/TemplatesSection'
import { useAddTag, useBehaviorTags, useDeleteTag, useRenameTag } from './api'

/** Behavior tags shown as chips when logging a session. */
export function TagsSection() {
  const { data, isPending, error } = useBehaviorTags()
  const add = useAddTag()
  const rename = useRenameTag()
  const del = useDeleteTag()
  const can = useCan()
  const canEdit = can('manage_tags')
  const canDelete = can('delete_tags')
  const [label, setLabel] = useState('')
  const mutationError = add.error ?? rename.error ?? del.error

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  async function submit(e: FormEvent) {
    e.preventDefault()
    await add.mutateAsync(label.trim())
    setLabel('')
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-neutral-500">These appear as quick-tap chips when logging a session. Trainers can also add tags while logging.</p>
      {mutationError && <p className="rounded-lg bg-flag-soft p-3 text-sm text-flag">{mutationError.message}</p>}

      <div>
        <h2 className="mb-2 font-semibold">Your tags</h2>
        {data.custom.length === 0 && <p className="text-sm text-neutral-500">No custom tags yet.</p>}
        <ul className="flex flex-wrap gap-2">
          {data.custom.map((t) => (
            <li key={t.id} className={`flex items-center rounded-full border border-neutral-300 bg-white pl-3 text-sm ${canDelete ? '' : 'pr-3'}`}>
              {canEdit ? (
                <button
                  className="min-h-11"
                  title="Rename"
                  onClick={() => {
                    const next = prompt('Rename tag', t.label)?.trim()
                    if (next && next !== t.label) rename.mutate({ id: t.id, label: next })
                  }}
                >
                  {t.label}
                </button>
              ) : (
                <span className="flex min-h-11 items-center">{t.label}</span>
              )}
              {canDelete && (
                <button className="min-h-11 px-3 text-neutral-400 hover:text-neutral-900" aria-label={`Delete ${t.label}`} onClick={() => confirm(`Delete "${t.label}"?`) && del.mutate(t.id)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input className={inputClass} placeholder="New tag, e.g. Place / Mat" required value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={add.isPending}>Add</Button>
          </form>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Built-in tags</h2>
        <ul className="flex flex-wrap gap-2">
          {data.presets.map((t) => (
            <li key={t.id} className="rounded-full bg-neutral-100 px-3 py-2 text-sm text-neutral-600">{t.label}</li>
          ))}
        </ul>
      </div>

      <div className="border-t border-neutral-200 pt-5">
        <TemplatesSection />
      </div>
    </div>
  )
}
