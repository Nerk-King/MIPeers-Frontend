import { ref } from 'vue'
import { isAuthenticated, signOut } from './auth'

export const IDLE_LIMIT_MS = 60 * 60 * 1000 // 1 hour

const LAST_ACTIVITY_KEY = 'mipeers-last-activity'

/** Set right before signing a user out for inactivity; Login.vue reads and clears it to explain why. */
export const idleExpired = ref(false)

function readLastActivity(): number {
 const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
 return Number.isFinite(stored) && stored > 0 ? stored : Date.now()
}

let lastActivity = readLastActivity()
let writeTimer: ReturnType<typeof setTimeout> | undefined
let checkTimer: ReturnType<typeof setTimeout> | undefined
let onExpire: (() => void) | undefined

function persistLastActivity() {
 writeTimer = undefined
 try { localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity)) } catch { /* Clock stays in-memory only if storage is unavailable. */ }
}

function scheduleCheck() {
 clearTimeout(checkTimer)
 if (!isAuthenticated.value) return
 const remaining = IDLE_LIMIT_MS - (Date.now() - lastActivity)
 if (remaining <= 0) {
  signOut()
  idleExpired.value = true
  onExpire?.()
  return
 }
 checkTimer = setTimeout(scheduleCheck, remaining)
}

function recordActivity() {
 lastActivity = Date.now()
 // Persisting on every event would thrash localStorage during continuous mousemove — writing the
 // in-memory value is enough to keep the live countdown accurate; only the write is throttled.
 if (!writeTimer) writeTimer = setTimeout(persistLastActivity, 2000)
 scheduleCheck()
}

/** Call right after a successful sign-in to arm the idle clock immediately for the new session. */
export function resetIdleTimer(): void {
 lastActivity = Date.now()
 persistLastActivity()
 scheduleCheck()
}

let started = false

/**
 * Tracks user activity (clicks, key presses, scrolling, touch, mouse movement) and signs the user
 * out after IDLE_LIMIT_MS (1 hour) without any of it — including inactivity that happened while the
 * tab was closed, since the last-activity timestamp is persisted to localStorage and read back on
 * load. Call once at app startup; onTimeout fires right after signOut() so the caller can redirect
 * (idleExpired lets the login screen explain why it landed there).
 */
export function startIdleWatcher(onTimeout: () => void): void {
 onExpire = onTimeout
 if (started) return
 started = true
 const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const
 events.forEach(event => window.addEventListener(event, recordActivity, { passive: true }))
 scheduleCheck()
}
