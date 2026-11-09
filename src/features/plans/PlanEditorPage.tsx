import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Button, Card, inputClass, actionClass } from '../../components/ui'
import { useDogSummary } from '../dogs/api'
import { usePlanStages, type StageStatus } from '../sessions/api'
import {
  useAddStage,
  useApplyTemplate,
  useDeleteStage,
  usePlanTemplates,
  useReorderStages,
  useSetStageStatus,
  useStageHistory,
  useUpdateStage,
  type Stage,
} from './api'

const STATUS: Record<StageStatus, { label: string; pill: string }> = {
  not_started: { label: 'Not started', pill: 'bg-neutral-100 text-neutral-500' },
  in_progress: { label: 'In progress', pill: 'bg-gold-400 text-neutral-900' },
  complete: { label: 'Complete', pill: 'bg-neutral-300 text-neutral-800' },
}
const RANK: Record<StageStatus, number> = { not_started: 0, in_progress: 1, complete: 2 }

/** F2: add, rename, reorder, delete stages; change status (with a reason when going backwards); history. */
export function PlanEditorPage() {
  const { dogId = '' } = useParams()
  const { data: dog } = useDogSummary(dogId)
  const { data: stages, isPending, error } = usePlanStages(dogId)
  const [mode, setMode] = useState<'template' | null>(null)

  if (isPending) return <p className="text-neutral-500">Loading plan…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const empty = stages.length === 0

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback={`/dogs/${dogId}`} fallbackLabel={dog?.name ?? 'Dog'} />
        <h1 className="text-2xl font-semibold">Training plan</h1>
        {!empty && (
          <p className="text-sm text-neutral-500">
            {stages.filter((s) => s.status === 'complete').length} of {stages.length} stages complete
          </p>
        )}
      </header>

      {empty && mode === null ? (
        <Card className="flex flex-col gap-3 border-dashed text-center">
          <p className="text-sm text-neutral-500">No plan yet for {dog?.name ?? 'this dog'}.</p>
          <Button onClick={() => setMode('template')}>Start from template</Button>
          <AddStageForm dogId={dogId} nextPosition={1} label="Add your first stage" />
        </Card>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {stages.map((s, i) => (
              <li key={s.id}>
                <StageRow dogId={dogId} stage={s} stages={stages} index={i} />
              </li>
            ))}
          </ol>
          {!empty && <AddStageForm dogId={dogId} nextPosition={(stages.at(-1)?.position ?? 0) + 1} label="Add stage" />}
          {mode === 'template' || empty ? (
            <TemplatePicker dogId={dogId} startAt={(stages.at(-1)?.position ?? 0) + 1} onDone={() => setMode(null)} appending={!empty} />
          ) : (
            <button className={`${actionClass} self-center`} onClick={() => setMode('template')}>
              Add stages from a template
            </button>
          )}
        </>
      )}

      {!empty && <StageHistory dogId={dogId} />}
    </section>
  )
}

function StageRow({ dogId, stage, stages, index }: { dogId: string; stage: Stage; stages: Stage[]; index: number }) {
  const update = useUpdateStage(dogId)
  const del = useDeleteStage(dogId)
  const reorder = useReorderStages(dogId)
  const setStatus = useSetStageStatus(dogId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const [description, setDescription] = useState(stage.description ?? '')
  const [pending, setPending] = useState<StageStatus | null>(null)
  const [reason, setReason] = useState('')
  const err = update.error ?? del.error ?? reorder.error ?? setStatus.error
  const backwards = pending != null && RANK[pending] < RANK[stage.status]

  function move(delta: -1 | 1) {
    const ordered = [...stages]
    const [s] = ordered.splice(index, 1)
    ordered.splice(index + delta, 0, s)
    reorder.mutate(ordered)
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    await update.mutateAsync({ id: stage.id, name: name.trim(), description: description.trim() || null })
    setEditing(false)
  }

  async function saveStatus(e: FormEvent) {
    e.preventDefault()
    if (!pending) return
    await setStatus.mutateAsync({ id: stage.id, status: pending, reason })
    setPending(null)
    setReason('')
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col">
          <button
            className="size-8 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            aria-label={`Move ${stage.name} up`}
            disabled={index === 0 || reorder.isPending}
            onClick={() => move(-1)}
          >
            ▲
          </button>
          <button
            className="size-8 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            aria-label={`Move ${stage.name} down`}
            disabled={index === stages.length - 1 || reorder.isPending}
            onClick={() => move(1)}
          >
            ▼
          </button>
        </div>

        {editing ? (
          <form onSubmit={saveEdit} className="flex flex-1 flex-col gap-2">
            <input className={inputClass} aria-label="Stage name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <textarea className={inputClass} aria-label="Description" placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" disabled={update.isPending}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => { setEditing(false); setName(stage.name); setDescription(stage.description ?? '') }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <span className="pt-1 font-medium">{stage.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS[stage.status].pill}`}>{STATUS[stage.status].label}</span>
            </div>
            {stage.description && <p className="text-sm text-neutral-600">{stage.description}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              <button className={actionClass} onClick={() => setEditing(true)}>Rename</button>
              <button
                className={actionClass}
                onClick={() => confirm(`Delete "${stage.name}"? Its status history is deleted too.`) && del.mutate(stage.id)}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <form onSubmit={saveStatus} className="flex flex-col gap-2">
          <div role="radiogroup" aria-label={`Status of ${stage.name}`} className="flex rounded-md bg-neutral-100 p-1">
            {(Object.keys(STATUS) as StageStatus[]).map((st) => {
              const active = (pending ?? stage.status) === st
              return (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPending(st === stage.status ? null : st)}
                  className={`min-h-10 flex-1 rounded-md text-xs font-medium ${active ? 'bg-white' : 'text-neutral-500'}`}
                >
                  {STATUS[st].label}
                </button>
              )
            })}
          </div>
          {pending && (
            <>
              <input
                className={inputClass}
                placeholder={backwards ? 'Why reopen? (required)' : 'Reason (optional)'}
                required={backwards}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={setStatus.isPending}>
                  {backwards ? 'Reopen' : `Mark ${STATUS[pending].label.toLowerCase()}`}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setPending(null); setReason('') }}>Cancel</Button>
              </div>
            </>
          )}
        </form>
      )}

      {err && <p className="text-sm text-flag">{err.message}</p>}
    </Card>
  )
}

function AddStageForm({ dogId, nextPosition, label }: { dogId: string; nextPosition: number; label: string }) {
  const add = useAddStage(dogId)
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    await add.mutateAsync({ name: name.trim(), position: nextPosition })
    setName('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input className={inputClass} aria-label="New stage name" placeholder="e.g. Loose-Leash Walking" required value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={add.isPending} className="shrink-0">{label}</Button>
      </div>
      {add.error && <p className="text-sm text-flag">{add.error.message}</p>}
    </form>
  )
}

function TemplatePicker({ dogId, startAt, appending, onDone }: { dogId: string; startAt: number; appending: boolean; onDone: () => void }) {
  const { data: templates, isPending } = usePlanTemplates()
  const apply = useApplyTemplate(dogId)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{appending ? 'Add from template' : 'Start from template'}</h2>
        <button className={actionClass} onClick={onDone}>Close</button>
      </div>
      <p className="text-sm text-neutral-500">Stages are copied into this dog's plan, and you can change them afterwards.</p>
      {isPending && <p className="text-sm text-neutral-500">Loading templates…</p>}
      {templates?.length === 0 && <p className="text-sm text-neutral-500">Your business has no templates yet.</p>}
      <ul className="flex flex-col gap-2">
        {templates?.map((t) => (
          <li key={t.id}>
            <button
              className="w-full rounded-md border border-neutral-300 bg-white p-3 text-left hover:bg-neutral-50 disabled:opacity-50"
              disabled={apply.isPending}
              onClick={async () => {
                await apply.mutateAsync({ templateId: t.id, stages: t.stages, startAt })
                onDone()
              }}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-neutral-500">{t.stages.map((s) => s.name).join(' → ') || 'No stages'}</div>
            </button>
          </li>
        ))}
      </ul>
      {apply.error && <p className="text-sm text-flag">{apply.error.message}</p>}
    </Card>
  )
}

function StageHistory({ dogId }: { dogId: string }) {
  const { data: events, isPending } = useStageHistory(dogId)
  if (isPending) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold">History</h2>
      {events?.length === 0 && <p className="text-sm text-neutral-500">No changes yet.</p>}
      <ol className="flex flex-col border-l-2 border-neutral-200 pl-4">
        {events?.map((e) => {
          const back = e.from_status && RANK[e.from_status] > RANK[e.to_status]
          return (
            <li key={e.id} className="relative py-2 text-sm">
              <span className={`absolute top-3.5 -left-[21px] size-2.5 rounded-full ${back ? 'bg-amber-500' : 'bg-neutral-400'}`} />
              <div>
                <span className="font-medium">{e.plan_stages?.name}</span>
                {': '}
                {e.from_status ? `${STATUS[e.from_status].label} ${back ? '↩︎' : '→'} ` : 'Added as '}
                {STATUS[e.to_status].label}
              </div>
              {e.reason && <div className="text-neutral-600">“{e.reason}”</div>}
              <div className="text-xs text-neutral-500">
                {new Date(e.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                {e.staff?.display_name && ` · ${e.staff.display_name}`}
                {e.session_id && ' · during a session'}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
