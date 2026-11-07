import { useState, type FormEvent } from 'react'
import { Button, Card, inputClass, actionClass } from '../../components/ui'
import { useCan } from '../auth/permissions'
import { useDeleteTemplate, usePlanTemplates, useSaveTemplate, type TemplateStageInput } from './api'

/** Org → Tags & templates: the organization's reusable curricula (DESIGN.md F2). */
export function TemplatesSection() {
  const { data: templates, isPending, error } = usePlanTemplates()
  const del = useDeleteTemplate()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const can = useCan()
  const canEdit = can('manage_templates')
  const canDelete = can('delete_templates')

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Plan templates</h2>
        <p className="text-sm text-neutral-500">
          Reusable plans, e.g. Foundations 1 → Foundations 2 → Freedom 1. Applying one copies its stages into a dog's plan; changing a template later doesn't change dogs already using it.
        </p>
      </div>
      {isPending && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-flag">{error.message}</p>}
      {del.error && <p className="text-sm text-flag">{del.error.message}</p>}

      <ul className="flex flex-col gap-2">
        {templates?.map((t) =>
          editing === t.id ? (
            <li key={t.id}>
              <TemplateForm id={t.id} initialName={t.name} initialStages={t.stages} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={t.id}>
              <Card className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-neutral-500">{t.stages.map((s) => s.name).join(' → ') || 'No stages'}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {canEdit && <button className={actionClass} onClick={() => setEditing(t.id)}>Edit</button>}
                  {canDelete && (
                    <button
                      className={actionClass}
                      onClick={() => confirm(`Delete the "${t.name}" template? Dogs already using it keep their plans.`) && del.mutate(t.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>
      {templates?.length === 0 && editing !== 'new' && <p className="text-sm text-neutral-500">No templates yet.</p>}

      {editing === 'new' ? (
        <TemplateForm initialName="" initialStages={[]} onDone={() => setEditing(null)} />
      ) : (
        canEdit && <Button variant="secondary" onClick={() => setEditing('new')}>+ New template</Button>
      )}
    </div>
  )
}

function TemplateForm({ id, initialName, initialStages, onDone }: { id?: string; initialName: string; initialStages: TemplateStageInput[]; onDone: () => void }) {
  const save = useSaveTemplate()
  const [name, setName] = useState(initialName)
  const [stages, setStages] = useState<TemplateStageInput[]>(initialStages.length ? initialStages : [{ name: '' }])
  const [error, setError] = useState<string | null>(null)

  const setStage = (i: number, patch: Partial<TemplateStageInput>) => setStages(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  function move(i: number, d: -1 | 1) {
    const next = [...stages]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setStages(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = stages
      .map((s) => ({ name: s.name.trim(), ...(s.description?.trim() ? { description: s.description.trim() } : {}) }))
      .filter((s) => s.name)
    if (!clean.length) return setError('Add at least one stage.')
    await save.mutateAsync({ id, name: name.trim(), stages: clean })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className={inputClass} aria-label="Template name" placeholder="Template name, e.g. Leash Manners" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <ol className="flex flex-col gap-2">
          {stages.map((s, i) => (
            <li key={i} className="flex items-start gap-1">
              <div className="flex flex-col">
                <button type="button" className="size-7 text-neutral-500 disabled:opacity-30" aria-label={`Move stage ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button type="button" className="size-7 text-neutral-500 disabled:opacity-30" aria-label={`Move stage ${i + 1} down`} disabled={i === stages.length - 1} onClick={() => move(i, 1)}>▼</button>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <input className={inputClass} aria-label={`Stage ${i + 1} name`} placeholder={`Stage ${i + 1}`} value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} />
                <input
                  className={`${inputClass} py-1.5 text-sm`}
                  aria-label={`Stage ${i + 1} description`}
                  placeholder="Description (optional)"
                  value={s.description ?? ''}
                  onChange={(e) => setStage(i, { description: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="size-11 shrink-0 text-neutral-400 hover:text-neutral-900 disabled:opacity-30"
                aria-label={`Remove stage ${i + 1}`}
                disabled={stages.length === 1}
                onClick={() => setStages(stages.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="min-h-11 rounded-lg border border-dashed border-neutral-400 text-sm" onClick={() => setStages([...stages, { name: '' }])}>
          + Add stage
        </button>
        {(error || save.error) && <p className="text-sm text-flag">{error ?? save.error?.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>{id ? 'Save template' : 'Create template'}</Button>
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
