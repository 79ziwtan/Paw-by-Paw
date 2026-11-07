/** The 3 Ds (DESIGN.md §3 F3). Stored per behavior in session_behaviors.measures (jsonb). */
export type Measure = { value: number; unit: string }
export type Measures = Partial<Record<'duration' | 'distance' | 'distraction', Measure>>

export const MEASURE_FIELDS = [
  { key: 'duration', label: 'Duration', short: 'Dur', units: ['sec', 'min'] },
  { key: 'distance', label: 'Distance', short: 'Dist', units: ['ft', 'yd', 'm'] },
  { key: 'distraction', label: 'Distraction', short: 'Distr', units: ['level'] }, // 1–5
] as const

export function formatMeasure(key: keyof Measures, m: Measure): string {
  const field = MEASURE_FIELDS.find((f) => f.key === key)!
  return key === 'distraction' ? `${field.short} ${m.value}/5` : `${field.short} ${m.value} ${m.unit}`
}
