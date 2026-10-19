// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Whether the Learn section is open, and on which lesson, kept in the address
 * (#learn or #learn/<lesson id>) so lessons can be linked to and the Back button
 * closes them.
 */
import { useSyncExternalStore } from 'react'

const PREFIX = '#learn'

/** null when Learn is closed, '' on its first page, otherwise the lesson id. */
function read(): string | null {
  const hash = window.location.hash
  if (hash === PREFIX) return ''
  if (hash.startsWith(`${PREFIX}/`)) return decodeURIComponent(hash.slice(PREFIX.length + 1))
  return null
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

/** Opens Learn, on a lesson if given. */
export function openLearn(lesson = '') {
  window.location.hash = lesson ? `${PREFIX}/${encodeURIComponent(lesson)}` : PREFIX
}

/** Closes Learn, leaving no # in the address. */
export function closeLearn() {
  if (read() === null) return
  window.history.pushState(null, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
