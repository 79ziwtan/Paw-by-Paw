import { inputClass } from '../../components/ui'

/** Editable list of homework tasks. Always keeps one empty row at the end to type into. */
export function HomeworkInput({ value, onChange }: { value: string[]; onChange: (tasks: string[]) => void }) {
  const rows = value.at(-1) === '' ? value : [...value, '']

  function set(i: number, text: string) {
    const next = [...rows]
    next[i] = text
    onChange(next)
  }
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((t, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-sm text-neutral-400">{i + 1}.</span>
          <input
            className={inputClass}
            aria-label={`Homework task ${i + 1}`}
            placeholder={i === 0 ? 'e.g. Name game: 10 reps, twice a day' : 'Another task (optional)'}
            value={t}
            onChange={(e) => set(i, e.target.value)}
          />
          {i < rows.length - 1 && (
            <button type="button" className="size-11 shrink-0 text-neutral-400 hover:text-neutral-900" aria-label={`Remove task ${i + 1}`} onClick={() => remove(i)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export const cleanTasks = (tasks: string[]) => tasks.map((t) => t.trim()).filter(Boolean)
