// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Whether the Learn section is open, and where, kept in the address (#learn,
 * #learn/<mode>/<lesson id>) so lessons can be linked to. Opening Learn adds one
 * history entry and moving between lessons replaces it, so the Back button leaves
 * Learn in one step.
 */
import { useSyncExternalStore } from 'react'

const PREFIX = '#learn'

/** null when Learn is closed, '' on its first page, otherwise what follows #learn/. */
function read(): string | null {
  const hash = window.location.hash
  if (hash === PREFIX) return ''
  if (!hash.startsWith(`${PREFIX}/`)) return null
  try {
    return decodeURIComponent(hash.slice(PREFIX.length + 1))
  } catch {
    // A hand-edited address with broken escapes: show Learn's first page.
    return ''
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
  }
}

export function useLearnRoute(): string | null {
  return useSyncExternalStore(subscribe, read, () => null)
}

const notify = () => window.dispatchEvent(new PopStateEvent('popstate'))

/** Opens Learn at a path such as "musician/write-a-phrase", or its first page. */
export function openLearn(path = '') {
  const url = path ? `${PREFIX}/${path.split('/').map(encodeURIComponent).join('/')}` : PREFIX
  if (read() === null) window.history.pushState({ learn: true }, '', url)
  else window.history.replaceState(window.history.state, '', url)
  notify()
}

/** Closes Learn, going back to where it was opened from when the app opened it. */
export function closeLearn() {
  if (read() === null) return
  if ((window.history.state as { learn?: boolean } | null)?.learn) {
    window.history.back()
  } else {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    notify()
  }
}
