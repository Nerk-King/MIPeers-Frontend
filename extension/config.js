// Real backend, shared by auth.js and rag.js (same endpoint, differentiated by rqService). Unlike
// the main app, this doesn't need a dev-proxy workaround for CORS — an extension with the matching
// host_permissions (see manifest.json) is exempt from page-level CORS restrictions entirely.
export const BACKEND_ENDPOINT = 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'

const LIVE_KEY = 'mipeers-ext-live'

// Shared (not owned by auth.js or rag.js alone) since both need it: auth.js uses it to decide
// whether login simulates a session locally or calls the real ilRest:getUserStaffNo, rag.js uses
// it to decide whether a question gets a canned answer or a real ilDecision:ragAsk call.
export function isLive() {
 return localStorage.getItem(LIVE_KEY) === 'true'
}

export function setLive(value) {
 localStorage.setItem(LIVE_KEY, String(value))
}

const THEME_KEY = 'mipeers-ext-theme'

export function getTheme() {
 return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

export function setTheme(value) {
 localStorage.setItem(THEME_KEY, value)
}

const ALWAYS_INCLUDE_CONTEXT_KEY = 'mipeers-ext-always-context'

// Default (false/unset) — popup.js unchecks "include page info"/"include screenshot" after every
// question so stale, already-sent context isn't silently resent on the next one. Turning this on
// keeps both checked across questions instead, for someone who wants every question in a session
// to carry the same context without re-ticking it each time.
export function getAlwaysIncludeContext() {
 return localStorage.getItem(ALWAYS_INCLUDE_CONTEXT_KEY) === 'true'
}

export function setAlwaysIncludeContext(value) {
 localStorage.setItem(ALWAYS_INCLUDE_CONTEXT_KEY, String(value))
}
