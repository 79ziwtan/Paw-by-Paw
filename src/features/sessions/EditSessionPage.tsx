import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { BackLink, useGoBack } from '../../components/BackLink'
import { Button, Card, inputClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useCan } from '../auth/permissions'
import { useDogSummary } from '../dogs/api'
import { useDeleteHomework, useEditHomework } from '../homework/api'
import { cleanTasks, HomeworkInput } from '../homework/HomeworkInput'
import { useBehaviorTags } from '../org/api'
import { useSession, useUpdateSession } from './api'
import { MeasureInputs, NotesField, Section, Segmented } from './LogSessionPage'
import type { Measures } from './measures'

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** Fix a saved session: time, behaviors (3 Ds + notes), food, rating, notes, homework. */
export function EditSessionPage() {
  const { dogId = '', sessionId = '' } = useParams()
  const { data: session, isPending, error } = useSession(sessionId)
  const { data: dog } = useDogSummary(dogId)
  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (error) return <p className="text-flag">{error.message}</p>
  return <EditForm session={session} dogId={dogId} dogName={dog?.name ?? 'Dog'} />
}

type Behavior = { measures: Measures; note: string }

function EditForm({ session: s, dogId, dogName }: { session: NonNullable<ReturnType<typeof useSession>['data']>; dogId: string; dogName: string }) {
  const { data: tags } = useBehaviorTags()
  const update = useUpdateSession()
  const goBack = useGoBack(`/dogs/${dogId}`)
  const [when, setWhen] = useState(toLocalInput(s.occurred_at))
  const [behaviors, setBehaviors] = useState<Map<string, Behavior>>(
    () => new Map(s.session_behaviors.map((b) => [b.tag_id, { measures: (b.measures ?? {}) as Measures, note: b.note ?? '' }])),
  )
  const [expanded, setExpanded] = useState<string | null>(null)
  const [takesFood, setTakesFood] = useState<boolean | null>(s.takes_food)
  const [rating, setRating] = useState<number | null>(s.rating)
  const [internalNotes, setInternalNotes] = useState(s.internal_notes)
  const [externalNotes, setExternalNotes] = useState(s.external_notes)
  const [newHomework, setNewHomework] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const allTags = [...(tags?.custom ?? []), ...(tags?.presets ?? [])]

  function toggle(id: string) {
    const m = new Map(behaviors)
    if (m.has(id)) m.delete(id)
    else m.set(id, { measures: {}, note: '' })
    setBehaviors(m)
  }
  const patch = (id: string, b: Partial<Behavior>) => setBehaviors(new Map(behaviors).set(id, { ...behaviors.get(id)!, ...b }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (behaviors.size === 0 && !internalNotes.trim() && !externalNotes.trim()) return setError('Keep at least one behavior or a note.')
    setError(null)
    await update.mutateAsync({
      sessionId: s.id,
      dogId,
      occurredAt: new Date(when).toISOString(),
      rating,
      takesFood,
      internalNotes: internalNotes.trim(),
      externalNotes: externalNotes.trim(),
      behaviors: [...behaviors].map(([tag_id, b]) => ({ tag_id, measures: b.measures, note: b.note.trim() || undefined })),
      newHomework: cleanTasks(newHomework),
    })
    goBack()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-20">
      <header>
        <BackLink fallback={`/dogs/${dogId}`} fallbackLabel={dogName} />
        <h1 className="text-xl font-semibold">Edit session: {dogName}</h1>
        <label className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
          When
          <input type="datetime-local" className="rounded border border-neutral-300 px-1" required value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <p className="mt-1 text-xs text-neutral-500">Stage changes, safety flags and the package count from this session aren't changed here.</p>
      </header>

      <Section title="What did you work on?">
        <div className="flex flex-wrap gap-2">
          {allTags.map((t) => {
            const on = behaviors.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.id)}
                className={`min-h-11 rounded-full border px-4 text-sm ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        {behaviors.size > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...behaviors].map(([tagId, b]) => {
              const label = allTags.find((t) => t.id === tagId)?.label ?? 'Tag'
              const open = expanded === tagId
              const summary = [Object.keys(b.measures).length && `${Object.keys(b.measures).length} of 3 Ds`, b.note.trim() && 'note'].filter(Boolean).join(' + ')
              return (
                <li key={tagId}>
                  <Card className="border-neutral-400 p-3 shadow-sm">
                    <button type="button" className="flex min-h-11 w-full items-center justify-between text-left" onClick={() => setExpanded(open ? null : tagId)}>
                      <span className="font-medium">{label}</span>
                      <span className="text-sm text-neutral-500">{summary || '+ 3 Ds or a note'} {open ? '▴' : '▾'}</span>
                    </button>
                    {open && (
                      <>
                        <MeasureInputs value={b.measures} onChange={(m) => patch(tagId, { measures: m })} />
                        <textarea
                          className={`${inputClass} mt-3`}
                          rows={2}
                          aria-label={`Note for ${label}`}
                          placeholder={`Note about ${label} (optional)`}
                          value={b.note}
                          onChange={(e) => patch(tagId, { note: e.target.value })}
                        />
                      </>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Takes food?">
        <Segmented options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} value={takesFood} onChange={setTakesFood} />
      </Section>

      <Section title="Session rating" hint="Optional">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rating === n}
              onClick={() => setRating(rating === n ? null : n)}
              className={`size-11 rounded-full border text-sm font-medium ${rating === n ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <NotesField label="Internal notes" hint="Only your team sees these" value={internalNotes} onChange={setInternalNotes} placeholder="" />
      <NotesField label="For the owner" hint="Can be sent in an update" value={externalNotes} onChange={setExternalNotes} placeholder="" />

      <Section title="Homework">
        {s.homework_tasks.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {s.homework_tasks.map((t) => (
              <li key={t.id}>
                <ExistingTask task={t} />
              </li>
            ))}
          </ul>
        )}
        <HomeworkInput value={newHomework} onChange={setNewHomework} />
      </Section>

      {(error || update.error) && <p className="rounded-lg bg-flag-soft p-3 text-sm text-flag">{error ?? update.error?.message}</p>}

      <div className="fixed inset-x-0 bottom-14 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button type="submit" className="flex-1" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
          <Button type="button" variant="secondary" onClick={goBack}>Cancel</Button>
        </div>
      </div>
    </form>
  )
}

/** A task already on this session: edit its wording right away, or delete (assigner or permission). */
function ExistingTask({ task: t }: { task: { id: string; text: string; created_by: string | null; completed_at: string | null } }) {
  const { staff } = useAuth()
  const canDelete = useCan()('delete_sessions') || t.created_by === staff?.id
  const edit = useEditHomework()
  const del = useDeleteHomework()
  const [text, setText] = useState(t.text)
  const [deleted, setDeleted] = useState(false)
  if (deleted) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{t.completed_at ? '☑' : '☐'}</span>
      <input
        className={inputClass}
        aria-label="Homework task"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text.trim() !== t.text && edit.mutate({ id: t.id, text: text.trim() })}
      />
      {canDelete && (
        <button
          type="button"
          className="size-11 shrink-0 text-neutral-400 hover:text-neutral-900"
          aria-label={`Delete "${t.text}"`}
          onClick={async () => {
            if (!confirm(`Delete "${t.text}"?`)) return
            await del.mutateAsync(t.id)
            setDeleted(true)
          }}
        >
          ×
        </button>
      )}
      {(edit.error || del.error) && <span className="text-xs text-flag">{(edit.error ?? del.error)?.message}</span>}
    </div>
  )
}
