/**
 * Lightweight navigation store backed by useSyncExternalStore.
 * No external dependencies — a module-level view variable + a listener set.
 */

import { useSyncExternalStore } from 'react'

export type View =
  | { kind: 'dashboard' }
  | { kind: 'ready' }
  | { kind: 'now' }
  | { kind: 'groom' }
  | { kind: 'settings' }
  | { kind: 'goal'; id: string }
  | { kind: 'project'; id: string }

// ---------------------------------------------------------------------------
// Module-level store
// ---------------------------------------------------------------------------

let _view: View = { kind: 'dashboard' }
const _listeners = new Set<() => void>()

function getView(): View {
  return _view
}

function setView(v: View): void {
  _view = v
  _listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export const navStore = { getView, setView, subscribe }

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useNav(): { view: View; go: (v: View) => void } {
  const view = useSyncExternalStore(subscribe, getView)
  return { view, go: setView }
}
