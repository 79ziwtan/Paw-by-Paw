import { useEffect, useRef, useState } from 'react'

// Web Speech API (Chrome, Safari, Edge; not Firefox). The phone keyboard's mic works everywhere as a fallback.
type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
const SR = (globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
const Ctor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition

/** Appends finished phrases to the text via `onText`. */
export function useDictation(onText: (phrase: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const latest = useRef(onText)
  useEffect(() => {
    latest.current = onText
  })
  useEffect(() => () => rec.current?.stop(), [])

  function toggle() {
    if (!Ctor) return
    if (listening) return rec.current?.stop()
    const r = new Ctor()
    r.continuous = true
    r.interimResults = false
    r.lang = navigator.language || 'en-US'
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) latest.current(e.results[i][0].transcript.trim())
      }
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  return { supported: !!Ctor, listening, toggle }
}
