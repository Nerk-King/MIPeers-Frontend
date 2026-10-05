import { ref } from 'vue'

// Single source of truth for every service's demo-vs-real behavior (login, chat, uploads, knowledge
// library). Defaults to demo mode (safe for anyone pulling the repo) and is toggled from the UI
// (the pill in the topbar), not per-service env vars — persisted so a choice survives a refresh.
const STORAGE_KEY = 'mipeers-live-mode'

function readStored(): boolean {
 try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export const isLive = ref(readStored())

export function setLive(value: boolean): void {
 isLive.value = value
 try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* Choice stays active for this tab even if storage is unavailable. */ }
}

export function toggleLive(): void {
 setLive(!isLive.value)
}
