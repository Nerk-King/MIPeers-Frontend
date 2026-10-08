import { ref } from 'vue'

// Single source of truth for every service's demo-vs-real behavior (login, chat, uploads, knowledge
// library). Defaults to live mode and is toggled from the UI (the pill in the topbar and on the
// login screen), not per-service env vars — persisted so a choice survives a refresh. An explicit
// prior choice (either way) always wins; only a first-ever visit falls back to the live default.
const STORAGE_KEY = 'mipeers-live-mode'

function readStored(): boolean {
 try {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === null ? true : stored === 'true'
 } catch { return true }
}

export const isLive = ref(readStored())

export function setLive(value: boolean): void {
 isLive.value = value
 try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* Choice stays active for this tab even if storage is unavailable. */ }
}

export function toggleLive(): void {
 setLive(!isLive.value)
}
