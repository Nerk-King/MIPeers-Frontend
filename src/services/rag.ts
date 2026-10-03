import { sessionToken } from './auth'

export interface RagRequest { question: string; agentId: string; history: { role: string; content: string }[] }
export interface RagResponse { answer: string; sourceIds: string[] }

// See the matching comment in services/auth.ts: dev runs through Vite's /ils-api proxy (vite.config.ts)
// so the sandbox's CORS allowlist (which a local dev server won't match) never blocks the response.
const DEFAULT_RAG_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const RAG_ENDPOINT = import.meta.env.VITE_RAG_ENDPOINT || DEFAULT_RAG_ENDPOINT

/** Demo mode is on by default (safe for anyone pulling the repo). Set VITE_RAG_DEMO=false to call the real ragAsk service. */
export const demoMode = import.meta.env.VITE_RAG_DEMO !== 'false'

/**
 * Calls the ilDecision:ragAsk service for every chat message, authenticated with the session
 * returned by the login API. The response contract from this service isn't mapped yet — once it is,
 * replace the TODO below with real field extraction for `answer` and `sourceIds`.
 */
export async function askKnowledge(request: RagRequest, signal?: AbortSignal): Promise<RagResponse> {
 if (demoMode) {
  await new Promise(resolve => setTimeout(resolve, 850))
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (/settle|holiday|clearing/i.test(request.question)) return { answer: 'Settlement guidance brings together the policy, operating procedures, and business calendar. Here are the areas to check:\n\n1. Settlement timeline — confirm the applicable cycle for the product and market.\n2. Cut-off times — review the deadline for submitting and amending instructions.\n3. Required instructions — validate the details before processing.\n4. Exceptions — follow the escalation procedure for failed or delayed settlements.\n5. Holidays — check the relevant business calendar for date adjustments.\n\nOpen the sources below to explore the sample documents. This is a demo answer, not verified operational guidance.', sourceIds: ['policy', 'procedures', 'calendar'] }
  if (/api|oauth|code|integrat/i.test(request.question)) return { answer: 'Start with the API Integration Guide to explore the integration workflow. A typical implementation authenticates through your application backend, sends the question and conversation context, and returns an answer with source references.\n\nThe frontend already has a dedicated service adapter for that handoff. Your backend can handle authentication and the Progress Agentic RAG connection.\n\nThis is a sample response; connect your knowledge service for answers grounded in your documentation.', sourceIds: ['api', 'manual'] }
  return { answer: `Here is a starting point for “${request.question}”.\n\nUse the knowledge library to explore product documentation and policies, or choose a specialist agent to narrow your question. You can open source references, ask a follow-up, and bookmark useful answers.\n\nThis workspace is currently in demo mode. Once connected, your knowledge service will generate a grounded answer here using your organization's documents.`, sourceIds: ['manual'] }
 }

 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: sessionToken.value,
  rqService: 'ilDecision:ragAsk',
  pcQuery: request.question,
 })
 const response = await fetch(`${RAG_ENDPOINT}?${params.toString()}`, { signal })
 // Mirror auth.ts: this backend family can return error details in the JSON body even on a
 // non-2xx status, so parse the body before deciding whether to give up on !response.ok.
 let data: { answer?: string; sourceIds?: string[]; rqErrorMessage?: string; error?: string; message?: string } | null = null
 try { data = await response.json() } catch { data = null }
 const errorMessage = typeof data?.rqErrorMessage === 'string' && data.rqErrorMessage ? data.rqErrorMessage
  : typeof data?.error === 'string' && data.error ? data.error
  : typeof data?.message === 'string' && data.message ? data.message
  : undefined
 if (errorMessage) throw new Error(errorMessage)
 if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
 // TODO: map the real ragAsk response shape once it's confirmed. For now, surface whatever came back.
 return { answer: typeof data?.answer === 'string' ? data.answer : JSON.stringify(data, null, 2), sourceIds: Array.isArray(data?.sourceIds) ? data.sourceIds : [] }
}
