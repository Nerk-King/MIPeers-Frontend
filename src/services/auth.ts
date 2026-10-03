import { computed, ref } from 'vue'

export interface LoginRequest { username: string; password: string }
export interface LoginResponse { token: string; name: string; staffNo?: string; userObj?: string }

const STORAGE_KEY = 'mipeers-auth'

// In `npm run dev`, go through Vite's /ils-api proxy (see vite.config.ts) so the browser's CORS
// policy never sees the cross-origin call — the sandbox only allows a specific origin, which a
// local dev server won't match. A real deployment needs an equivalent server-side proxy, or the
// sandbox's CORS allowlist updated for that origin, or override VITE_AUTH_ENDPOINT directly
// (the same /ils-api path also works under `vite preview`, via the proxy config for that server).
const DEFAULT_AUTH_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const AUTH_ENDPOINT = import.meta.env.VITE_AUTH_ENDPOINT || DEFAULT_AUTH_ENDPOINT

/** Demo mode is on by default (safe for anyone pulling the repo). Set VITE_AUTH_DEMO=false to call the real login service. */
export const demoMode = import.meta.env.VITE_AUTH_DEMO !== 'false'

function readStoredAuth(): LoginResponse | null {
 try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

const stored = readStoredAuth()
const authToken = ref(stored?.token ?? '')
const authName = ref(stored?.name ?? '')
const authStaffNo = ref(stored?.staffNo ?? '')
const authUserObj = ref(stored?.userObj ?? '')
export const isAuthenticated = computed(() => !!authToken.value)
export const currentUserName = computed(() => authName.value)
/** The session id parsed out of the login API's rqAuthentication field (after the "Session:\" prefix). Sent as rqAuthentication on every ragAsk call. */
export const sessionToken = computed(() => authToken.value)
/** pcStaffNo / pcUserObj from the login response. Not used yet, but kept for later. */
export const staffNo = computed(() => authStaffNo.value)
export const userObj = computed(() => authUserObj.value)

/**
 * Calls the ilRest:getUserStaffNo service to authenticate, using "user:<username>|<password>" as
 * rqAuthentication since there's no session yet. On failure the service returns
 * { rqResponse: { rqErrorMessage, rqErrorCode, rqErrorID } }. On success it returns
 * { rqResponse: { rqAuthentication: "Session:\<token>", pcStaffNo, pcUserObj } }.
 */
async function requestLogin(request: LoginRequest): Promise<LoginResponse> {
 if (demoMode) {
  await new Promise(resolve => setTimeout(resolve, 700))
  if (!request.username.trim() || !request.password.trim()) throw new Error('Enter your username and password to continue.')
  if (request.password.length < 4) throw new Error('Incorrect username or password.')
  return { token: `demo-${Date.now()}`, name: request.username }
 }

 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `user:${request.username}|${request.password}`,
  rqService: 'ilRest:getUserStaffNo',
 })
 const response = await fetch(`${AUTH_ENDPOINT}?${params.toString()}`)
 // This service returns its error details in the JSON body even on a non-2xx status, so parse
 // the body and look for rqErrorMessage before giving up on a plain !response.ok check.
 let data: { rqResponse?: { rqErrorMessage?: string; rqAuthentication?: string; pcStaffNo?: string; pcUserObj?: string } } | null = null
 try { data = await response.json() } catch { data = null }
 const rq = data?.rqResponse ?? {}
 if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
 if (!response.ok) throw new Error('Unable to sign in right now. Please try again.')
 const rawAuth = typeof rq.rqAuthentication === 'string' ? rq.rqAuthentication : ''
 const session = rawAuth.replace(/^Session:\\/, '')
 if (!session) throw new Error('The authentication service returned an invalid response.')
 return {
  token: session,
  name: request.username,
  staffNo: typeof rq.pcStaffNo === 'string' ? rq.pcStaffNo : '',
  userObj: typeof rq.pcUserObj === 'string' ? rq.pcUserObj : '',
 }
}

export async function signIn(request: LoginRequest): Promise<void> {
 const data = await requestLogin(request)
 authToken.value = data.token
 authName.value = data.name
 authStaffNo.value = data.staffNo ?? ''
 authUserObj.value = data.userObj ?? ''
 try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* Session stays active for this tab even if storage is unavailable. */ }
}

export function signOut(): void {
 authToken.value = ''
 authName.value = ''
 authStaffNo.value = ''
 authUserObj.value = ''
 try { localStorage.removeItem(STORAGE_KEY) } catch { /* Nothing left to clear. */ }
}
