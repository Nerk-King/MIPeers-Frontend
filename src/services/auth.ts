import { computed, ref } from 'vue'

export interface LoginRequest { username: string; password: string }
export interface LoginResponse { token: string; name: string }

const STORAGE_KEY = 'mipeers-auth'
export const demoMode = !import.meta.env.VITE_AUTH_ENDPOINT

function readStoredAuth(): LoginResponse | null {
 try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

const stored = readStoredAuth()
const authToken = ref(stored?.token ?? '')
const authName = ref(stored?.name ?? '')
export const isAuthenticated = computed(() => !!authToken.value)
export const currentUserName = computed(() => authName.value)

/** Replace this adapter with your application backend's authentication endpoint. Secrets stay server-side. */
async function requestLogin(request: LoginRequest): Promise<LoginResponse> {
 if (!demoMode) {
  const response = await fetch(import.meta.env.VITE_AUTH_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  if (!response.ok) throw new Error(response.status === 401 ? 'Incorrect username or password.' : 'Unable to sign in right now. Please try again.')
  const data = await response.json()
  if (typeof data.token !== 'string' || !data.token) throw new Error('The authentication service returned an invalid response.')
  return { token: data.token, name: typeof data.name === 'string' && data.name ? data.name : request.username }
 }
 await new Promise(resolve => setTimeout(resolve, 700))
 if (!request.username.trim() || !request.password.trim()) throw new Error('Enter your username and password to continue.')
 if (request.password.length < 4) throw new Error('Incorrect username or password.')
 return { token: `demo-${Date.now()}`, name: request.username }
}

export async function signIn(request: LoginRequest): Promise<void> {
 const data = await requestLogin(request)
 authToken.value = data.token
 authName.value = data.name
 try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* Session stays active for this tab even if storage is unavailable. */ }
}

export function signOut(): void {
 authToken.value = ''
 authName.value = ''
 try { localStorage.removeItem(STORAGE_KEY) } catch { /* Nothing left to clear. */ }
}
