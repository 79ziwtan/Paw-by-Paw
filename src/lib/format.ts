/** Normalize a phone number to E.164. Assumes US (+1) when no country code is given. */
export function toE164(input: string): string | null {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** +15550102299 → (555) 010-2299 for US numbers; others unchanged. */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

/** Age in years (may be fractional, e.g. 0.5) → approximate birth date (YYYY-MM-DD). */
export function ageToBirthDate(years: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - Math.round(years * 12))
  return d.toISOString().slice(0, 10)
}

export function formatAge(birthDate: string | null): string | null {
  if (!birthDate) return null
  const months = Math.floor((Date.now() - new Date(birthDate).getTime()) / (30.44 * 864e5))
  if (months < 12) return `${Math.max(months, 0)} mo`
  return `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}`
}
