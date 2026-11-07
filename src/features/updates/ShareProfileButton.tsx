import { useQueryClient } from '@tanstack/react-query'
import { actionClass } from '../../components/ui'
import { OWNER_LINK_MODE, useShareProfile } from './api'

/**
 * "Send": makes a fresh owner profile link for the household (opening on `dogId` if given;
 * the owner's other dogs are still there, collapsed). What happens next depends on VITE_OWNER_LINKS:
 *   open — the link opens in a new tab (for testing; nothing is texted)
 *   text — the link is texted to the owner; if texting isn't set up, "Open link" is shown instead
 */
export function ShareProfileButton({ householdId, dogId, label = 'Send', className }: { householdId: string; dogId?: string | null; label?: string; className?: string }) {
  const share = useShareProfile()
  const qc = useQueryClient()
  const result = share.data
  // Sending moves the session off "Not sent yet", which would remove this button mid-confirmation,
  // so refresh that list only after the confirmation has shown, or once the link is opened.
  const refreshUnsent = () => qc.invalidateQueries({ queryKey: ['unsent_sessions'] })

  function send() {
    if (OWNER_LINK_MODE === 'open') {
      // Open the tab inside the click so it isn't blocked as a pop-up, then point it at the link.
      const tab = window.open('', '_blank')
      share.mutate(
        { householdId, dogId },
        {
          onSuccess: (r) => {
            if (tab) tab.location.href = r.link
            else window.location.href = r.link
            share.reset()
            setTimeout(refreshUnsent, 500)
          },
          onError: () => tab?.close(),
        },
      )
      return
    }
    share.mutate({ householdId, dogId }, { onSuccess: (r) => { if (r.sent) setTimeout(refreshUnsent, 2500) } })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {result && !result.sent ? (
        <a href={result.link} target="_blank" rel="noreferrer" className={actionClass} onClick={() => setTimeout(() => { share.reset(); refreshUnsent() }, 500)}>
          Open link ↗
        </a>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={share.isPending}
          className={className ?? 'flex min-h-9 items-center rounded-lg border border-neutral-900 bg-neutral-900 px-3 text-sm font-medium text-white shadow-sm disabled:opacity-50'}
        >
          {share.isPending ? (OWNER_LINK_MODE === 'open' ? 'Opening…' : 'Sending…') : result?.sent ? 'Texted ✓' : label}
        </button>
      )}
      {result?.sent && result.to === 'test number' && <span className="text-xs text-neutral-500">Test mode: sent to the test number</span>}
      {result && !result.sent && <span className="text-xs text-neutral-500">Texting isn't set up, so nothing was sent</span>}
      {share.error && <span className="max-w-56 text-right text-xs text-flag">{share.error.message}</span>}
    </span>
  )
}
