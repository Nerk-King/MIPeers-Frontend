import { BACKEND_ENDPOINT, isLive } from './config.js'

const SESSION_KEY = 'mipeers-ext-session'

// chrome.storage.session (not localStorage) — its defining feature is that it's cleared when the
// browser itself closes, which is exactly what a login session should do, while still surviving
// popup open/close and persisting across tabs within the same browser session. Needs the
// "storage" permission in manifest.json. Async (no synchronous equivalent), unlike localStorage —
// every caller here and in rag.js/popup.js awaits it.

export async function getSession() {
 const result = await chrome.storage.session.get(SESSION_KEY)
 return result[SESSION_KEY] ?? null
}

export async function clearSession() {
 await chrome.storage.session.remove(SESSION_KEY)
}

async function saveSession(session) {
 await chrome.storage.session.set({ [SESSION_KEY]: session })
 return session
}

/**
 * Signs in. In Demo mode this never touches the network, matching the main app's demo-mode
 * requestLogin() — any non-empty username and a password of at least 4 characters succeeds. In
 * Live mode it calls ilRest:getUserStaffNo, the same login service src/services/auth.ts uses.
 * Business errors come back as rqResponse.rqErrorMessage even on a non-2xx status, so the body is
 * parsed before giving up on a plain !response.ok check.
 */
export async function login(username, password) {
 if (!isLive()) {
  await new Promise(resolve => setTimeout(resolve, 500))
  if (!username.trim() || !password.trim()) throw new Error('Enter your username and password to continue.')
  if (password.length < 4) throw new Error('Incorrect username or password.')
  return saveSession({ token: `demo-${Date.now()}`, name: username })
 }

 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `user:${username}|${password}`,
  rqService: 'ilRest:getUserStaffNo',
 })
 const response = await fetch(`${BACKEND_ENDPOINT}?${params.toString()}`)
 let data = null
 try { data = await response.json() } catch { data = null }
 const rq = data?.rqResponse ?? {}
 if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
 if (!response.ok) throw new Error('Unable to sign in right now. Please try again.')
 const rawAuth = typeof rq.rqAuthentication === 'string' ? rq.rqAuthentication : ''
 const token = rawAuth.replace(/^Session:\\/, '')
 if (!token) throw new Error('The authentication service returned an invalid response.')

 return saveSession({ token, name: username })
}
