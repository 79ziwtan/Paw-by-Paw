import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Button, Card, chipClass, chipOff, chipOn, inputClass, selectClass } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useDogSummary } from '../dogs/api'
import { cleanTasks, HomeworkInput } from '../homework/HomeworkInput'
import { useBehaviorTags } from '../org/api'
import { ShareProfileButton } from '../updates/ShareProfileButton'
import { useAddCustomTag, useLogSession, useOpenPackage, usePlanStages, type StageAction, type StageStatus } from './api'
import { MEASURE_FIELDS, type Measures } from './measures'
import { useDictation } from './useDictation'

type Severity = 'low' | 'med' | 'high'
const STATUS_LABEL: Record<StageStatus, string> = { not_started: 'Not started', in_progress: 'In progress', complete: 'Complete' }
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const NEXT_STEPS = ['Repeat at this level', 'Add distance', 'Add duration', 'Add distraction', 'Ready for next stage', 'Owner practice at home']
const FLAG_NOTES = ['Lunged at a dog', 'Growled', 'Mouthed / nipped', 'Resource guarding', 'Pulled out of collar']

/** 1-minute log: built for a phone, between lessons. Mostly taps; typing is optional. */
export function LogSessionPage() {
  const { dogId = '' } = useParams()
  const navigate = useNavigate()
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
  const [nextStep, setNextStep] = useState('')
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
  const [saved, setSaved] = useState(false)

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
    } else {
      m.set(id, {})
      setExpanded(id) // open the 3 Ds for the tag just picked
    }
    setSelected(m)
  }

  async function createCustomTag() {
    const label = customTag?.trim()
    if (!label) return setCustomTag(null)
    try {
      const t = await addTag.mutateAsync(label)
      setSelected(new Map(selected).set(t.id, {}))
      setExpanded(t.id)
      setCustomTag(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (selected.size === 0 && !internalNotes.trim() && !externalNotes.trim() && !nextStep.trim())
      return setError('Tap at least one behavior.')
    if (flagOn && !flag.note.trim()) return setError('Tap or type what happened for the safety flag.')
    if (stageAction === 'set') {
      if (!customStage) return setError('Choose which stage to change.')
      if (!customStatus) return setError(`Choose the new status for ${customStage.name}.`)
      if (!stageReason.trim()) return setError('Say why the stage changed.')
    }
    try {
      await logSession.mutateAsync({
        dogId,
        occurredAt: when ? new Date(when).toISOString() : new Date().toISOString(),
        rating: null,
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
        nextStep,
      })
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Saved → optional share update → back to the calendar.
  if (saved) {
    return (
      <section className="flex min-h-[65dvh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Session saved</h1>
        <p className="max-w-xs text-neutral-600">
          {dog?.name}'s session is saved{nextStep.trim() && <> · next step: <strong>{nextStep.trim()}</strong></>}.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={() => navigate('/', { replace: true })}>Back to calendar</Button>
          {dog?.household_id && (
            <ShareProfileButton
              householdId={dog.household_id}
              dogId={dogId}
              label={`Share update with ${dog.owner_name?.split(' ')[0] ?? 'owner'} (optional)`}
              className="min-h-11 w-full rounded-md border border-neutral-300 bg-white px-4 font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            />
          )}
          <Link to={`/dogs/${dogId}/summary`} replace className="py-2 text-sm text-neutral-500 underline">View {dog?.name}'s card</Link>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <BackLink fallback={`/dogs/${dogId}/summary`} fallbackLabel={dog?.name ?? 'Dog'} className="text-sm font-medium text-neutral-500" />
          <h1 className="truncate text-xl font-semibold">Log session: {dog?.name ?? '…'}</h1>
          <p className="text-sm text-neutral-500">
            {when ? new Date(when).toLocaleString() : 'Just now'} ·{' '}
            {when === null ? (
              <button type="button" className="underline" onClick={() => setWhen(openedAt)}>change</button>
            ) : (
              <input type="datetime-local" className="rounded border border-neutral-300 px-1" value={when} max={openedAt} onChange={(e) => setWhen(e.target.value)} />
            )}
          </p>
        </div>
      </header>

      <Section title="Worked on" hint="Tap all that apply">
        <div className="flex flex-wrap gap-2">
          {allTags.map((t) => (
            <button key={t.id} type="button" aria-pressed={selected.has(t.id)} onClick={() => toggleTag(t.id)} className={`${chipClass} ${selected.has(t.id) ? chipOn : chipOff}`}>
              {t.label}
            </button>
          ))}
          {customTag === null ? (
            <button type="button" onClick={() => setCustomTag('')} className={`${chipClass} border-dashed border-neutral-400 text-neutral-600`}>
              + Tag
            </button>
          ) : (
            <span className="flex gap-1">
              <input
                autoFocus
                className="min-h-11 w-36 rounded-md border border-neutral-400 px-3 text-sm"
                placeholder="New tag"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); createCustomTag() }
                  if (e.key === 'Escape') setCustomTag(null)
                }}
              />
              <Button type="button" variant="secondary" onClick={createCustomTag} disabled={addTag.isPending}>Add</Button>
            </span>
          )}
        </div>

        {selected.size > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...selected].map(([tagId, measures]) => {
              const label = allTags.find((t) => t.id === tagId)?.label ?? 'Tag'
              const open = expanded === tagId
              const filled = MEASURE_FIELDS.filter((f) => measures[f.key]).map((f) => f.label[0] + f.label.slice(1, 4).toLowerCase())
              const note = behaviorNotes.get(tagId)
              return (
                <li key={tagId}>
                  <Card className={`p-3 ${open ? 'border-gold-300' : ''}`}>
                    <button type="button" className="flex min-h-10 w-full items-center justify-between text-left" onClick={() => setExpanded(open ? null : tagId)}>
                      <span className="font-semibold">{label}</span>
                      <span className="text-sm text-neutral-500">{filled.length ? filled.join(' · ') : 'Add 3 Ds'} ({open ? 'hide' : 'show'})</span>
                    </button>
                    {open && (
                      <>
                        <MeasureInputs value={measures} onChange={(m) => setSelected(new Map(selected).set(tagId, m))} />
                        {note === undefined ? (
                          <button type="button" className="mt-2 text-sm text-neutral-500 underline" onClick={() => setBehaviorNotes(new Map(behaviorNotes).set(tagId, ''))}>
                            + note
                          </button>
                        ) : (
                          <input
                            autoFocus
                            className={`${inputClass} mt-3`}
                            aria-label={`Note for ${label}`}
                            placeholder={`Note about ${label}`}
                            value={note}
                            onChange={(e) => setBehaviorNotes(new Map(behaviorNotes).set(tagId, e.target.value))}
                          />
                        )}
                      </>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Took food?" hint="Quick stress check">
        <Segmented options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} value={takesFood} onChange={setTakesFood} />
      </Section>

      <Section title="Safety">
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-300 bg-white px-3">
          <input type="checkbox" role="switch" className="size-5" checked={flagOn} onChange={(e) => setFlagOn(e.target.checked)} />
          <span className={flagOn ? 'text-flag' : ''}>Flag a safety concern</span>
        </label>
        {flagOn && (
          <div className="mt-2 flex flex-col gap-2 rounded-md border border-flag bg-flag-soft p-3">
            <Segmented
              options={(['low', 'med', 'high'] as const).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
              value={flag.severity}
              onChange={(severity) => severity && setFlag({ ...flag, severity })}
              activeClass="border-flag bg-flag text-white"
            />
            <div className="flex flex-wrap gap-1.5">
              {FLAG_NOTES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={flag.note === n}
                  onClick={() => setFlag({ ...flag, note: flag.note === n ? '' : n })}
                  className={`min-h-9 rounded-md border px-3 text-sm ${flag.note === n ? 'border-flag bg-flag text-white' : 'border-neutral-300 bg-white'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input className={inputClass} placeholder="Or describe it" value={flag.note} onChange={(e) => setFlag({ ...flag, note: e.target.value })} />
            <p className="text-xs text-neutral-600">Pinned at the top of {dog?.name ?? 'this dog'}'s card until resolved.</p>
          </div>
        )}
      </Section>

      <Section title="Next step" hint="For the next lesson">
        <div className="flex flex-wrap gap-2">
          {NEXT_STEPS.map((n) => (
            <button key={n} type="button" aria-pressed={nextStep === n} onClick={() => setNextStep(nextStep === n ? '' : n)} className={`${chipClass} ${nextStep === n ? chipOn : chipOff}`}>
              {n}
            </button>
          ))}
        </div>
        <input className={`${inputClass} mt-2`} aria-label="Next step" placeholder="Or type one…" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
      </Section>

      <details className="rounded-md border border-neutral-300 bg-white p-3">
        <summary className="cursor-pointer font-semibold">
          More <span className="text-sm font-normal text-neutral-500">(notes, homework, stage change)</span>
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <NotesField label="For the owner" hint="Can be shared in an update" value={externalNotes} onChange={setExternalNotes} placeholder={`${dog?.name ?? 'Your dog'} practiced checking in before the leash got tight.`} />
          <NotesField label="Internal notes" hint="Team only" value={internalNotes} onChange={setInternalNotes} placeholder="Owner hasn't practiced turns much…" />
          <Section title="Homework">
            <HomeworkInput value={homework} onChange={setHomework} />
          </Section>
          <Section title="Stage changed?">
            {stages.length === 0 ? (
              <p className="text-sm text-neutral-500">No plan yet. <Link to={`/dogs/${dogId}/plan`} className="underline">Build plan</Link></p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-neutral-500">Current: <span className="font-medium text-neutral-900">{current?.name ?? 'none in progress'}</span></p>
                <Radio name="stage" checked={stageAction === null} onChange={() => setStageAction(null)}>No change</Radio>
                {advanceLabel && <Radio name="stage" checked={stageAction === 'advance'} onChange={() => setStageAction('advance')}>{advanceLabel}</Radio>}
                <Radio name="stage" checked={stageAction === 'set'} onChange={() => setStageAction('set')}>Custom: set any stage</Radio>
                {stageAction === 'set' && (
                  <div className="flex flex-col gap-2 rounded-md border border-neutral-300 bg-white p-3">
                    <select className={selectClass} aria-label="Stage to change" value={customStageId} onChange={(e) => { setCustomStageId(e.target.value); setCustomStatus(null) }}>
                      <option value="">Choose stage…</option>
                      {stages.map((s) => <option key={s.id} value={s.id}>{s.name} ({STATUS_LABEL[s.status].toLowerCase()})</option>)}
                    </select>
                    {customStage && (
                      <div className="flex gap-2" role="radiogroup" aria-label="New status">
                        {(Object.keys(STATUS_LABEL) as StageStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            role="radio"
                            aria-checked={customStatus === st}
                            disabled={st === customStage.status}
                            onClick={() => setCustomStatus(st)}
                            className={`min-h-11 flex-1 rounded-md border text-sm font-medium disabled:opacity-40 ${customStatus === st ? chipOn : chipOff}`}
                          >
                            {STATUS_LABEL[st]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {stageAction && (
                  <input
                    className={inputClass}
                    aria-label="Why the stage changed"
                    placeholder={stageAction === 'set' ? 'Why? e.g. Regressed around other dogs' : 'Note (optional)'}
                    value={stageReason}
                    onChange={(e) => setStageReason(e.target.value)}
                  />
                )}
              </div>
            )}
          </Section>
        </div>
      </details>

      {openPackage && (
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-gold-500)]" checked={countPackage} onChange={(e) => setCountPackage(e.target.checked)} />
          Count toward {openPackage.name} ({openPackage.sessions_used} of {openPackage.sessions_total} used)
        </label>
      )}

      {error && <p className="rounded-md bg-flag-soft p-3 text-sm text-flag">{error}</p>}

      <div className="fixed inset-x-0 bottom-14 z-10 border-t border-neutral-200 bg-white p-3">
        <div className="mx-auto max-w-3xl">
          <Button type="submit" className="w-full text-base" disabled={logSession.isPending}>
            {logSession.isPending ? 'Saving…' : `Save log${selected.size ? ` · ${selected.size} ${selected.size === 1 ? 'behavior' : 'behaviors'}` : ''}`}
          </Button>
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

export function Segmented<T>({ options, value, onChange, activeClass = chipOn }: {
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
          className={`min-h-12 flex-1 rounded-md border text-sm font-semibold ${value === o.value ? activeClass : 'border-neutral-300 bg-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm ${checked ? 'border-gold-500 bg-gold-50' : 'border-neutral-300 bg-white'}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-[var(--color-gold-500)]" />
      {children}
    </label>
  )
}

/** Tap presets for the 3 Ds; "Other" opens a number + unit field. */
const PRESETS = {
  duration: [
    { value: 5, unit: 'sec', label: '5s' },
    { value: 10, unit: 'sec', label: '10s' },
    { value: 30, unit: 'sec', label: '30s' },
    { value: 1, unit: 'min', label: '1m' },
    { value: 2, unit: 'min', label: '2m' },
    { value: 5, unit: 'min', label: '5m' },
  ],
  distance: [
    { value: 3, unit: 'ft', label: '3ft' },
    { value: 6, unit: 'ft', label: '6ft' },
    { value: 10, unit: 'ft', label: '10ft' },
    { value: 20, unit: 'ft', label: '20ft' },
    { value: 30, unit: 'ft', label: '30ft' },
    { value: 50, unit: 'ft', label: '50ft' },
  ],
} as const

export function MeasureInputs({ value, onChange }: { value: Measures; onChange: (m: Measures) => void }) {
  const [custom, setCustom] = useState<Set<string>>(
    () => new Set((['duration', 'distance'] as const).filter((k) => value[k] && !PRESETS[k].some((p) => p.value === value[k]!.value && p.unit === value[k]!.unit))),
  )
  function set(key: keyof Measures, m: { value: number; unit: string } | null) {
    const next = { ...value }
    if (!m) delete next[key]
    else next[key] = m
    onChange(next)
  }
  const mini = 'min-h-10 min-w-11 flex-1 rounded-md border px-2 text-sm font-medium'

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-neutral-100 pt-3">
      {(['duration', 'distance'] as const).map((key) => {
        const field = MEASURE_FIELDS.find((f) => f.key === key)!
        const m = value[key]
        const isCustom = custom.has(key)
        return (
          <div key={key}>
            <div className="mb-1 text-sm text-neutral-600">{field.label}</div>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {PRESETS[key].map((p) => {
                const on = !isCustom && m?.value === p.value && m.unit === p.unit
                return (
                  <button key={p.label} type="button" aria-pressed={on} onClick={() => set(key, on ? null : { value: p.value, unit: p.unit })} className={`${mini} ${on ? chipOn : chipOff}`}>
                    {p.label}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={isCustom}
                onClick={() => {
                  const c = new Set(custom)
                  if (isCustom) { c.delete(key); set(key, null) } else c.add(key)
                  setCustom(c)
                }}
                className={`${mini} ${isCustom ? chipOn : chipOff}`}
              >
                Other
              </button>
            </div>
            {isCustom && (
              <div className="mt-1.5 flex gap-2">
                <input
                  autoFocus
                  className={`${inputClass} flex-1`}
                  inputMode="decimal"
                  aria-label={field.label}
                  value={m?.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '')
                    set(key, v === '' ? null : { value: Number(v), unit: m?.unit ?? field.units[0] })
                  }}
                />
                <select
                  className="min-h-11 cursor-pointer rounded-md border border-neutral-400 bg-white px-2 text-sm"
                  aria-label={`${field.label} unit`}
                  value={m?.unit ?? field.units[0]}
                  onChange={(e) => m && set(key, { value: m.value, unit: e.target.value })}
                >
                  {field.units.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            )}
          </div>
        )
      })}
      <div>
        <div className="mb-1 text-sm text-neutral-600">
          Distraction <span className="text-neutral-400">(1 quiet room to 5 busy park)</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = value.distraction?.value === n
            return (
              <button key={n} type="button" aria-pressed={on} onClick={() => set('distraction', on ? null : { value: n, unit: 'level' })} className={`${mini} ${on ? chipOn : chipOff}`}>
                {n}
              </button>
            )
          })}
        </div>
      </div>
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
        <textarea className={`${inputClass} pr-20`} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.toggle}
            aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
            className={`absolute top-1.5 right-1.5 min-h-9 rounded-md border px-2 text-xs ${dictation.listening ? 'border-gold-500 bg-gold-300' : 'border-neutral-300 bg-white'}`}
          >
            {dictation.listening ? 'Stop' : 'Dictate'}
          </button>
        )}
      </div>
    </Section>
  )
}
