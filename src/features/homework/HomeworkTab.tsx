import { useState, type FormEvent } from 'react'
import { Button, Card, inputClass, actionClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useCan } from '../auth/permissions'
import { useAssignHomework, useDeleteHomework, useDogHomework, useEditHomework, useSetHomeworkDone, type HomeworkRow } from './api'
import { cleanTasks, HomeworkInput } from './HomeworkInput'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Dog profile → Homework: assign tasks, check them off, see what the owner has done. */
export function HomeworkTab({ dogId, readOnly = false }: { dogId: string; readOnly?: boolean }) {
  const { data: tasks, isPending, error } = useDogHomework(dogId)
  const [assigning, setAssigning] = useState(false)

  if (isPending) return <p className="text-neutral-500">Loading homework…</p>
  if (error) return <p className="text-flag">{error.message}</p>

  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))

  return (
    <div className="flex flex-col gap-4">
      {!readOnly &&
        (assigning ? (
          <AssignForm dogId={dogId} onDone={() => setAssigning(false)} />
        ) : (
          <Button variant="secondary" onClick={() => setAssigning(true)}>+ Assign homework</Button>
        ))}

      {tasks.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-neutral-500">No homework yet.</Card>
      ) : (
        <>
          <TaskList title={`To do (${open.length})`} tasks={open} readOnly={readOnly} empty="All caught up." />
          {done.length > 0 && <TaskList title={`Done (${done.length})`} tasks={done} readOnly={readOnly} />}
        </>
      )}
    </div>
  )
}

function AssignForm({ dogId, onDone }: { dogId: string; onDone: () => void }) {
  const assign = useAssignHomework(dogId)
  const [tasks, setTasks] = useState<string[]>([])
  const clean = cleanTasks(tasks)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!clean.length) return
    await assign.mutateAsync(clean)
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Assign homework</h2>
        <HomeworkInput value={tasks} onChange={setTasks} />
        {assign.error && <p className="text-sm text-flag">{assign.error.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={!clean.length || assign.isPending}>
            Assign {clean.length > 1 ? `${clean.length} tasks` : 'task'}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function TaskList({ title, tasks, readOnly, empty }: { title: string; tasks: HomeworkRow[]; readOnly: boolean; empty?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-neutral-500">{title}</h2>
      {tasks.length === 0 && empty && <p className="text-sm text-neutral-500">{empty}</p>}
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskRow task={t} readOnly={readOnly} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One task: tick, edit wording, delete (whoever assigned it, or with delete_sessions). */
function TaskRow({ task: t, readOnly }: { task: HomeworkRow; readOnly: boolean }) {
  const { staff } = useAuth()
  const setDone = useSetHomeworkDone()
  const del = useDeleteHomework()
  const editText = useEditHomework()
  const canDelete = useCan()('delete_sessions') || (!!staff && t.created_by === staff.id)
  const [draft, setDraft] = useState<string | null>(null)
  const error = setDone.error ?? del.error ?? editText.error

  async function save(e: FormEvent) {
    e.preventDefault()
    if (draft?.trim() && draft.trim() !== t.text) await editText.mutateAsync({ id: t.id, text: draft.trim() })
    setDraft(null)
  }

  return (
    <Card className="flex items-start gap-3 p-3">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0"
        aria-label={`Mark "${t.text}" ${t.completed_at ? 'not done' : 'done'}`}
        checked={!!t.completed_at}
        disabled={readOnly || setDone.isPending}
        onChange={(e) => setDone.mutate({ id: t.id, done: e.target.checked })}
      />
      <div className="min-w-0 flex-1">
        {draft !== null ? (
          <form onSubmit={save} className="flex flex-col gap-2">
            <input className={inputClass} aria-label="Task" autoFocus required value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" disabled={editText.isPending}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <>
            <div className={t.completed_at ? 'text-neutral-500 line-through' : ''}>{t.text}</div>
            <div className="text-xs text-neutral-500">{source(t)}</div>
            {t.completed_at && <div className="text-xs text-neutral-500">{completion(t)}</div>}
            {!readOnly && (
              <div className="mt-1.5 flex gap-2">
                <button className={`${actionClass} min-h-8 px-2 text-xs`} onClick={() => setDraft(t.text)}>Edit</button>
                {canDelete && (
                  <button className={`${actionClass} min-h-8 px-2 text-xs`} onClick={() => confirm(`Delete "${t.text}"?`) && del.mutate(t.id)}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {error && <p className="text-xs text-flag">{error.message}</p>}
      </div>
    </Card>
  )
}

function source(t: HomeworkRow) {
  const who = t.assigned_by?.display_name ? ` · ${t.assigned_by.display_name}` : ''
  if (t.owner_updates?.sent_at) return `Sent in owner update ${day(t.owner_updates.sent_at)}${who}`
  if (t.sessions) return `From session ${day(t.sessions.occurred_at)}${who}`
  return `Assigned ${day(t.created_at)}${who}`
}

function completion(t: HomeworkRow) {
  const by = t.completer?.display_name ? `marked by ${t.completer.display_name}` : t.update_id ? 'checked off by owner' : ''
  return `Done ${day(t.completed_at!)}${by ? ` · ${by}` : ''}`
}
