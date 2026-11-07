import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink, useGoBack } from '../../components/BackLink'
import { Button, Card, inputClass, selectClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useDogSummary } from '../dogs/api'
import { cleanTasks, HomeworkInput } from '../homework/HomeworkInput'
import { useBehaviorTags } from '../org/api'
import { useAddCustomTag, useLogSession, useOpenPackage, usePlanStages, type StageAction, type StageStatus } from './api'
import { MEASURE_FIELDS, type Measures } from './measures'
import { useDictation } from './useDictation'

type Severity = 'low' | 'med' | 'high'
const STATUS_LABEL: Record<StageStatus, string> = { not_started: 'Not started', in_progress: 'In progress', complete: 'Complete' }
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

/** Flow B: designed to take under 2 minutes. Only a tag or a note is required. */
export function LogSessionPage() {
  const { dogId = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack(`/dogs/${dogId}`)
  const { staff } = useAuth()
  const { data: dog } = useDogSummary(dogId)
  const { data: tags } = useBehaviorTags()
  const { data: stages = [] } = usePlanStages(dogId)
  const { data: openPackage } = useOpenPackage(dogId)
  const addTag = useAddCustomTag(staff!.org_id)
  const logSession = useLogSession()

  const [selected, setSelected] = useState<Map<string, Measures>>(new Map())
  const [behaviorNotes, setBehaviorNotes] = useState<Map<string, string>>(new Map())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [customTag, setCustomTag] = useState<string | null>(null)
  const [takesFood, setTakesFood] = useState<boolean | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [externalNotes, setExternalNotes] = useState('')
  const [flagOn, setFlagOn] = useState(false)
  const [flag, setFlag] = useState<{ severity: Severity; note: string }>({ severity: 'med', note: '' })
  const [stageAction, setStageAction] = useState<StageAction['action'] | null>(null)
  const [customStageId, setCustomStageId] = useState('')
  const [customStatus, setCustomStatus] = useState<StageStatus | null>(null)
  const [stageReason, setStageReason] = useState('')
  const [countPackage, setCountPackage] = useState(true)
  const [homework, setHomework] = useState<string[]>([])
  const [when, setWhen] = useState<string | null>(null)
  const [openedAt] = useState(() => toLocalInput(new Date()))
  const [error, setError] = useState<string | null>(null)
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null)

  const allTags = [...(tags?.custom ?? []), ...(tags?.presets ?? [])]
  const current = stages.find((s) => s.status === 'in_progress')
  const next = stages.find((s) => s.status !== 'complete' && (!current || s.position > current.position))
  const advanceLabel = current
    ? next ? `Complete ${current.name} & start ${next.name}` : `Complete ${current.name} (final stage)`
    : next ? `Start ${next.name}` : null
  const customStage = stages.find((s) => s.id === customStageId)

  function toggleTag(id: string) {
    const m = new Map(selected)
    if (m.has(id)) {
      m.delete(id)
      if (expanded === id) setExpanded(null)
    } else m.set(id, {})
    setSelected(m)
  }

  async function createCustomTag() {
    const label = customTag?.trim()
    if (!label) return setCustomTag(null)
    try {
      const t = await addTag.mutateAsync(label)
      setSelected(new Map(selected).set(t.id, {}))
      setCustomTag(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (selected.size === 0 && !internalNotes.trim() && !externalNotes.trim())
      return setError('Pick at least one behavior or add a note.')
    if (flagOn && !flag.note.trim()) return setError('Add a note describing the safety concern.')
    if (stageAction === 'set') {
      if (!customStage) return setError('Choose which stage to change.')
      if (!customStatus) return setError(`Choose the new status for ${customStage.name}.`)
      if (!stageReason.trim()) return setError('Say why the stage changed.')
    }
    try {
      const id = await logSession.mutateAsync({
        dogId,
        occurredAt: when ? new Date(when).toISOString() : new Date().toISOString(),
        rating,
        takesFood,
        internalNotes: internalNotes.trim(),
        externalNotes: externalNotes.trim(),
        behaviors: [...selected].map(([tag_id, measures]) => ({ tag_id, measures, note: behaviorNotes.get(tag_id)?.trim() || undefined })),
        flag: flagOn ? { severity: flag.severity, note: flag.note.trim() } : null,
        stage:
          stageAction === 'advance' ? { action: 'advance', reason: stageReason.trim() || undefined }
          : stageAction === 'set' ? { action: 'set', target_stage_id: customStageId, status: customStatus!, reason: stageReason.trim() }
          : null,
        countPackage: !!openPackage && countPackage,
        homework: cleanTasks(homework),
      })
      if (externalNotes.trim() || cleanTasks(homework).length) setSavedSessionId(id)
      else goBack()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Post-save prompt (Flow B decision point)
  if (savedSessionId) {
    return (
      <section className="flex min-h-[60dvh] flex-col justify-center gap-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-neutral-900 text-2xl">✓</div>
        <h1 className="text-xl font-semibold">Session saved</h1>
        <p className="text-neutral-600">Send {dog?.owner_name?.split(' ')[0] ?? 'the owner'} a structured update while the session is fresh?</p>
        <Button onClick={() => navigate(`/dogs/${dogId}/update/${savedSessionId}`, { replace: true })}>Yes, send update</Button>
        <Button variant="secondary" onClick={goBack}>Not now</Button>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-20">
      <header>
        <BackLink fallback={`/dogs/${dogId}`} fallbackLabel={dog?.name ?? 'Dog'} />
        <h1 className="text-xl font-semibold">Log Session{dog && `: ${dog.name}`}</h1>
        <p className="text-sm text-neutral-500">
          {when ? new Date(when).toLocaleString() : 'Now'} ·{' '}
          {when === null ? (
            <button type="button" className="underline" onClick={() => setWhen(openedAt)}>change</button>
          ) : (
            <input type="datetime-local" className="rounded border border-neutral-300 px-1" value={when} max={openedAt} onChange={(e) => setWhen(e.target.value)} />
          )}
        </p>
      </header>

      <Section title="What did you work on?">
        <div className="flex flex-wrap gap-2">
          {allTags.map((t) => {
            const on = selected.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t.id)}
                className={`min-h-11 rounded-full border px-4 text-sm ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
              >
                {t.label}
              </button>
            )
          })}
          {customTag === null ? (
            <button type="button" onClick={() => setCustomTag('')} className="min-h-11 rounded-full border border-dashed border-neutral-400 px-4 text-sm text-neutral-600">
              + Custom tag
            </button>
          ) : (
            <span className="flex gap-1">
              <input
                autoFocus
                className="min-h-11 w-40 rounded-full border border-neutral-400 px-4 text-sm"
                placeholder="New tag"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); createCustomTag() }
                  if (e.key === 'Escape') setCustomTag(null)
                }}
              />
              <Button type="button" variant="secondary" className="rounded-full" onClick={createCustomTag} disabled={addTag.isPending}>Add</Button>
            </span>
          )}
        </div>

        {selected.size > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...selected].map(([tagId, measures]) => {
              const label = allTags.find((t) => t.id === tagId)?.label ?? 'Tag'
              const open = expanded === tagId
              const filled = Object.keys(measures).length
              const note = behaviorNotes.get(tagId) ?? ''
              const summary = [filled && `${filled} of 3 Ds`, note.trim() && 'note'].filter(Boolean).join(' + ')
              return (
                <li key={tagId}>
                  <Card className="border-neutral-400 p-3 shadow-sm">
                    <button type="button" className="flex min-h-11 w-full items-center justify-between text-left" onClick={() => setExpanded(open ? null : tagId)}>
                      <span className="font-medium">{label}</span>
                      <span className="text-sm text-neutral-500">{summary || '+ 3 Ds or a note'} {open ? '▴' : '▾'}</span>
                    </button>
                    {open && (
                      <>
                        <MeasureInputs value={measures} onChange={(m) => setSelected(new Map(selected).set(tagId, m))} />
                        <textarea
                          className={`${inputClass} mt-3`}
                          rows={2}
                          aria-label={`Note for ${label}`}
                          placeholder={`Note about ${label} (optional), e.g. Better on the second try`}
                          value={note}
                          onChange={(e) => setBehaviorNotes(new Map(behaviorNotes).set(tagId, e.target.value))}
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

      <Section title="Takes food?" hint="Quick stress check">
        <Segmented
          options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]}
          value={takesFood}
          onChange={setTakesFood}
        />
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

      <NotesField label="Internal notes" hint="Only your team sees these" value={internalNotes} onChange={setInternalNotes} placeholder="Owner hasn't practiced turns much…" />
      <NotesField label="For the owner" hint="Can be sent in an update" value={externalNotes} onChange={setExternalNotes} placeholder="Biscuit practiced checking in before the leash got tight." />

      <Section title="Homework" hint="Optional · shows on the dog's Homework tab">
        <HomeworkInput value={homework} onChange={setHomework} />
      </Section>

      <Section title="Safety">
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3">
          <span className={flagOn ? 'font-medium text-flag' : ''}>⚑ Flag a safety concern</span>
          <input type="checkbox" className="size-5 accent-[var(--color-flag)]" checked={flagOn} onChange={(e) => setFlagOn(e.target.checked)} />
        </label>
        {flagOn && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border-2 border-flag bg-flag-soft p-3">
            <Segmented
              options={(['low', 'med', 'high'] as const).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
              value={flag.severity}
              onChange={(severity) => severity && setFlag({ ...flag, severity })}
              activeClass="border-flag bg-flag text-white"
            />
            <textarea className={inputClass} rows={2} placeholder="What happened? e.g. Lunged at a dog within 10 ft" value={flag.note} onChange={(e) => setFlag({ ...flag, note: e.target.value })} />
            <p className="text-xs text-neutral-600">Pinned in red on the profile and dog list until resolved.</p>
          </div>
        )}
      </Section>

      <Section title="Stage changed?">
        {stages.length === 0 ? (
          <p className="text-sm text-neutral-500">No plan yet. <Link to={`/dogs/${dogId}/plan`} className="underline">Build plan</Link></p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500">Current: <span className="font-medium text-neutral-900">{current?.name ?? 'none in progress'}</span></p>
            <Radio name="stage" checked={stageAction === null} onChange={() => setStageAction(null)}>No change</Radio>
            {advanceLabel && (
              <Radio name="stage" checked={stageAction === 'advance'} onChange={() => setStageAction('advance')}>
                {advanceLabel}
              </Radio>
            )}
            <Radio name="stage" checked={stageAction === 'set'} onChange={() => setStageAction('set')}>
              Custom: set any stage
            </Radio>

            {stageAction === 'set' && (
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-300 bg-white p-3">
                <select
                  className={selectClass}
                  aria-label="Stage to change"
                  value={customStageId}
                  onChange={(e) => {
                    setCustomStageId(e.target.value)
                    setCustomStatus(null)
                  }}
                >
                  <option value="">Choose stage…</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({STATUS_LABEL[s.status].toLowerCase()})</option>
                  ))}
                </select>
                {customStage && (
                  <>
                    <div className="flex gap-2" role="radiogroup" aria-label="New status">
                      {(Object.keys(STATUS_LABEL) as StageStatus[]).map((st) => {
                        const same = st === customStage.status
                        return (
                          <button
                            key={st}
                            type="button"
                            role="radio"
                            aria-checked={customStatus === st}
                            disabled={same}
                            onClick={() => setCustomStatus(st)}
                            className={`min-h-11 flex-1 rounded-lg border text-sm font-medium disabled:opacity-40 ${customStatus === st ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
                          >
                            {STATUS_LABEL[st]}
                          </button>
                        )
                      })}
                    </div>
                    {customStatus && (
                      <p className="text-sm text-neutral-600">
                        {customStage.name}: {STATUS_LABEL[customStage.status].toLowerCase()} → <strong>{STATUS_LABEL[customStatus].toLowerCase()}</strong>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {stageAction && (
              <input
                className={inputClass}
                aria-label="Why the stage changed"
                required={stageAction === 'set'}
                placeholder={stageAction === 'set' ? 'Why? e.g. Regressed around other dogs' : 'Note (optional)'}
                value={stageReason}
                onChange={(e) => setStageReason(e.target.value)}
              />
            )}
          </div>
        )}
      </Section>

      {openPackage && (
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 bg-white px-3 text-sm">
          <input type="checkbox" className="size-5" checked={countPackage} onChange={(e) => setCountPackage(e.target.checked)} />
          Count toward {openPackage.name} ({openPackage.sessions_used} of {openPackage.sessions_total} used)
        </label>
      )}

      {error && <p className="rounded-lg bg-flag-soft p-3 text-sm text-flag">{error}</p>}

      <div className="fixed inset-x-0 bottom-14 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button type="submit" className="w-full" disabled={logSession.isPending}>{logSession.isPending ? 'Saving…' : 'Save log'}</Button>
        </div>
      </div>
    </form>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">
        {title} {hint && <span className="text-sm font-normal text-neutral-500">· {hint}</span>}
      </h2>
      {children}
    </section>
  )
}

export function Segmented<T>({ options, value, onChange, activeClass = 'border-neutral-900 bg-neutral-900 text-white' }: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  activeClass?: string
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={`min-h-11 flex-1 rounded-lg border text-sm font-medium ${value === o.value ? activeClass : 'border-neutral-300 bg-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm ${checked ? 'border-neutral-900' : 'border-neutral-300'} bg-white`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}

export function MeasureInputs({ value, onChange }: { value: Measures; onChange: (m: Measures) => void }) {
  function set(key: keyof Measures, v: string, unit: string) {
    const next = { ...value }
    if (v === '') delete next[key]
    else next[key] = { value: Number(v), unit }
    onChange(next)
  }

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-neutral-100 pt-3">
      {MEASURE_FIELDS.map((f) => {
        const m = value[f.key]
        if (f.key === 'distraction') {
          return (
            <div key={f.key}>
              <div className="mb-1 text-sm text-neutral-600">{f.label} <span className="text-neutral-400">(1 = quiet room, 5 = busy park)</span></div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={m?.value === n}
                    onClick={() => set('distraction', m?.value === n ? '' : String(n), 'level')}
                    className={`min-h-11 flex-1 rounded-lg border text-sm ${m?.value === n ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )
        }
        const unit = m?.unit ?? f.units[0]
        return (
          <div key={f.key} className="flex items-center gap-2">
            <span className="w-20 text-sm text-neutral-600">{f.label}</span>
            <input
              className={`${inputClass} flex-1`}
              inputMode="decimal"
              aria-label={f.label}
              value={m?.value ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '')
                set(f.key, v, unit)
              }}
            />
            <select
              className="min-h-11 cursor-pointer rounded-lg border border-neutral-400 bg-white px-2 text-sm shadow-sm"
              aria-label={`${f.label} unit`}
              value={unit}
              onChange={(e) => m && set(f.key, String(m.value), e.target.value)}
            >
              {f.units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        )
      })}
    </div>
  )
}

export function NotesField({ label, hint, value, onChange, placeholder }: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const dictation = useDictation((phrase) => onChange(value ? `${value} ${phrase}` : phrase))
  return (
    <Section title={label} hint={hint}>
      <div className="relative">
        <textarea className={`${inputClass} pr-14`} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.toggle}
            aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
            className={`absolute top-1.5 right-1.5 size-11 rounded-full text-lg ${dictation.listening ? 'animate-pulse bg-neutral-900 text-white' : 'bg-neutral-100'}`}
          >
            🎤
          </button>
        )}
      </div>
    </Section>
  )
}
