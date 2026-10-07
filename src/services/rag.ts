import { sessionToken } from './auth'
import { documents } from '../data'
import { withTimeout } from './timeout'
import { isLive } from './liveMode'
import { summarizeTitle } from './title'

export interface RagRequest { question: string; agentId: string; title: string; context: string }
export interface RagSource { name: string; page: string }
export interface RagResponse { answer: string; sources: RagSource[] }
export interface ChatContext { context: string; usedChars: number; limitChars: number; percent: number; truncated: boolean }

// Budget for pcContext specifically, measured as URL-encoded length (not raw JSON length) since
// that's what actually determines request-line size. Tuned down from 3000 -> 1500 -> 750 (too
// tight, reset almost every turn) -> 1250. TODO: pcContext is a query param only because ragAsk's
// contract was already built that way (GET + query string) — moving context into the request body
// would remove this size constraint entirely, but that's a backend contract change, not something
// this adapter can do alone.
export const CONTEXT_CHAR_LIMIT = 1250

/**
 * Converts chat history into the [{author, text}] shape ragAsk expects for pcContext. Unlike a
 * sliding window, this doesn't drop the oldest turns one at a time — once the full history no
 * longer fits within limitChars, the whole context is cleared (the model starts fresh from that
 * point) rather than sending a partially-trimmed window. Exported so the UI can show the same
 * usage/limit the request will actually use.
 */
export function buildChatContext(history: { role: string; content: string }[], limitChars = CONTEXT_CHAR_LIMIT): ChatContext {
 const entries = history.map(m => ({ author: m.role === 'user' ? 'USER' : 'NUCLIA', text: m.content }))
 let context = entries.length ? JSON.stringify(entries) : ''
 let truncated = false
 if (encodeURIComponent(context).length > limitChars) {
  context = ''
  truncated = true
 }
 const usedChars = encodeURIComponent(context).length
 return { context, usedChars, limitChars, percent: Math.min(100, Math.round((usedChars / limitChars) * 100)), truncated }
}

// See the matching comment in services/auth.ts: dev runs through Vite's /ils-api proxy (vite.config.ts)
// so the sandbox's CORS allowlist (which a local dev server won't match) never blocks the response.
const DEFAULT_RAG_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const RAG_ENDPOINT = import.meta.env.VITE_RAG_ENDPOINT || DEFAULT_RAG_ENDPOINT

/** Resolves demo-mode source ids against the local sample documents, for display-only {name, page} pairs. */
function demoSources(ids: string[]): RagSource[] {
 return ids.map(id => { const doc = documents.find(d => d.id === id); return { name: doc?.name ?? id, page: doc?.pages ?? '—' } })
}

/**
 * Calls the ilDecision:ragAsk service for every chat message, authenticated with the session
 * returned by the login API ("Session:<token>" — note no backslash here, unlike the raw value the
 * login response itself echoes back). pcTitle carries the chat's own title. request.context is the
 * already-built pcContext value (see buildChatContext) — the caller owns deciding which slice of
 * history it represents, since resetting it once it overflows is a stateful, per-conversation
 * decision this function has no way to track on its own. On success the service returns:
 * { rqResponse: { opcResponse, opcResources, opcPageNumber } } — opcResponse is the answer text;
 * opcResources/opcPageNumber are comma-delimited lists, position-aligned with each other.
 */
export async function askKnowledge(request: RagRequest, signal?: AbortSignal): Promise<RagResponse> {
 if (!isLive.value) {
  await new Promise(resolve => setTimeout(resolve, 850))
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (/settle|holiday|clearing/i.test(request.question)) return { answer: 'Settlement guidance brings together the policy, operating procedures, and business calendar. Here are the areas to check:\n\n1. Settlement timeline — confirm the applicable cycle for the product and market.\n2. Cut-off times — review the deadline for submitting and amending instructions.\n3. Required instructions — validate the details before processing.\n4. Exceptions — follow the escalation procedure for failed or delayed settlements.\n5. Holidays — check the relevant business calendar for date adjustments.\n\nOpen the sources below to explore the sample documents. This is a demo answer, not verified operational guidance.', sources: demoSources(['policy', 'procedures', 'calendar']) }
  if (/api|oauth|code|integrat/i.test(request.question)) return { answer: 'Start with the API Integration Guide to explore the integration workflow. A typical implementation authenticates through your application backend, sends the question and conversation context, and returns an answer with source references.\n\nThe frontend already has a dedicated service adapter for that handoff. Your backend can handle authentication and the Progress Agentic RAG connection.\n\nThis is a sample response; connect your knowledge service for answers grounded in your documentation.', sources: demoSources(['api', 'manual']) }
  return { answer: `Here is a starting point for “${request.question}”.\n\nUse the knowledge library to explore product documentation and policies, or choose a specialist agent to narrow your question. You can open source references, ask a follow-up, and bookmark useful answers.\n\nThis workspace is currently in demo mode. Once connected, your knowledge service will generate a grounded answer here using your organization's documents.`, sources: demoSources(['manual']) }
 }

 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:ragAsk',
  pcQuery: request.question,
  pcTitle: request.title,
 })
 if (request.context) params.set('pcContext', request.context)
 const timeout = withTimeout(signal, 45000)
 try {
  const response = await fetch(`${RAG_ENDPOINT}?${params.toString()}`, { signal: timeout.signal })
  // Same backend family as auth.ts: error details come back in the JSON body (rqResponse.rqErrorMessage)
  // even on a non-2xx status, so parse the body before deciding whether to give up on !response.ok.
  let data: { rqResponse?: { rqErrorMessage?: string; opcResponse?: string; opcResources?: string; opcPageNumber?: string } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
  if (typeof rq.opcResponse !== 'string') throw new Error('The knowledge service returned an invalid response.')

  const names = typeof rq.opcResources === 'string' && rq.opcResources ? rq.opcResources.split(',').map(s => s.trim()).filter(Boolean) : []
  const pages = typeof rq.opcPageNumber === 'string' ? rq.opcPageNumber.split(',').map(s => s.trim()) : []
  const sources = names.map((name, index) => ({ name, page: pages[index] || '—' }))

  return { answer: rq.opcResponse, sources }
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError') {
   if (timeout.didTimeOut()) throw new Error('The knowledge service took too long to respond. Please try again.')
   throw e
  }
  throw e
 } finally {
  timeout.cleanup()
 }
}

export interface RagHistoryMessage { id: string; role: 'user' | 'assistant'; content: string; sources: RagSource[] }
export interface RagHistoryConversation { id: string; datasetObj?: number; title: string; date: string; messages: RagHistoryMessage[] }

interface RagHistoryDataset { DatasetObj?: number; DatasetDescription?: string; DatasetContents?: string; DatasetCreatedDatetime?: string | null; LastModifiedDatetime?: string | null }

// Some saved values arrive wrapped in an extra pair of quotes (e.g. "\"test\"", or "\"\"" for empty).
function unquote(value: unknown): string {
 const text = typeof value === 'string' ? value.trim() : ''
 return text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).trim() : text
}

/**
 * Calls ilDecision:fetchRagHistory for the signed-in user's saved chats. Each ttChatHistory entry is
 * one conversation: DatasetDescription is its title (the pcTitle ragAsk was sent with) and
 * DatasetContents is a JSON-encoded string of [{query, response, resource}] turns, where resource is
 * a comma-delimited list of source file names. Ids are derived from DatasetObj so they stay stable
 * across reloads. Newest conversation first.
 */
export async function fetchRagHistory(signal?: AbortSignal): Promise<RagHistoryConversation[]> {
 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:fetchRagHistory',
 })
 const timeout = withTimeout(signal, 45000)
 try {
  const response = await fetch(`${RAG_ENDPOINT}?${params.toString()}`, { signal: timeout.signal })
  let data: { rqResponse?: { rqErrorMessage?: string; ttChatHistory?: RagHistoryDataset[] } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('The chat history service is unavailable. Please try again.')
  if (!data?.rqResponse) throw new Error('The chat history service returned an invalid response.')
  // An empty temp-table can come back as a missing field rather than [].
  const datasets = Array.isArray(rq.ttChatHistory) ? rq.ttChatHistory : []

  const conversations: RagHistoryConversation[] = []
  for (const [index, dataset] of datasets.entries()) {
   let turns: unknown
   try { turns = JSON.parse(dataset.DatasetContents || '[]') } catch { continue }
   if (!Array.isArray(turns)) continue
   const id = 'ils-' + (dataset.DatasetObj ?? index)
   const messages: RagHistoryMessage[] = []
   for (const [turnIndex, turn] of turns.entries()) {
    const { query, response: answer, resource } = (turn ?? {}) as { query?: unknown; response?: unknown; resource?: unknown }
    const sources = unquote(resource).split(',').map(name => name.trim()).filter(Boolean).map(name => ({ name, page: '—' }))
    messages.push({ id: `${id}-${turnIndex}-q`, role: 'user', content: unquote(query), sources: [] })
    messages.push({ id: `${id}-${turnIndex}-a`, role: 'assistant', content: unquote(answer), sources })
   }
   const firstQuestion = messages[0]?.content || ''
   conversations.push({
    id,
    datasetObj: typeof dataset.DatasetObj === 'number' ? dataset.DatasetObj : undefined,
    title: unquote(dataset.DatasetDescription) || summarizeTitle(firstQuestion) || 'Untitled chat',
    date: dataset.LastModifiedDatetime || dataset.DatasetCreatedDatetime || new Date().toISOString(),
    messages,
   })
  }
  return conversations.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The chat history service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

/** Calls ilDecision:deleteRagHistory to delete one saved conversation, identified by the DatasetObj from fetchRagHistory. */
export async function deleteRagHistory(datasetObj: number, signal?: AbortSignal): Promise<void> {
 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:deleteRagHistory',
  ipdDatasetObj: String(datasetObj),
 })
 const timeout = withTimeout(signal, 45000)
 try {
  const response = await fetch(`${RAG_ENDPOINT}?${params.toString()}`, { signal: timeout.signal })
  let data: { rqResponse?: { rqErrorMessage?: string } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('Unable to delete this conversation. Please try again.')
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The chat history service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}
