import { BACKEND_ENDPOINT, isLive } from './config.js'
import { getSession } from './auth.js'

/**
 * Builds the exact ilDecision:ragAsk request body — shared by liveAnswer() (actually sent) and
 * demoAnswer() (only logged), so what you see logged in Demo mode is guaranteed to match what Live
 * mode would really send, not a close approximation.
 *
 * pcExtraContext/pcExtraContextImages are arrays, one element each for now since this only ever
 * captures one page's info/one screenshot at a time — but sent as LONGCHAR, i.e. JSON-stringified
 * text rather than native nested JSON, same convention as opcDocuments elsewhere in this codebase
 * (see knowledge.ts): the backend parses the string back into an array/object server-side. Each
 * pcExtraContextImages element, once parsed, is { content_type, b64encoded } — content_type is
 * always "image/png" here since that's the format captureScreenshot() requests from
 * chrome.tabs.captureVisibleTab().
 */
function buildRequestBody(question, extraContext, extraContextImages, session) {
 return {
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${session?.token ?? ''}`,
  rqService: 'ilDecision:ragAsk',
  pcQuery: question,
  pcTitle: 'Page Assistant chat',
  pcContext: '',
  pcFilter: '',
  piTopResult: 5,
  pcExtraContext: JSON.stringify(extraContext ? [extraContext] : []),
  pcExtraContextImages: JSON.stringify(extraContextImages ? [{ content_type: 'image/png', b64encoded: extraContextImages }] : []),
 }
}

/** Demo mode never calls the network — logs the payload Live mode would have sent, for visibility. */
async function demoAnswer(question, extraContext, extraContextImages) {
 const session = await getSession()
 const body = buildRequestBody(question, extraContext, extraContextImages, session)
 console.log('[MiPeers PoC] Demo mode — ragAsk payload (not sent):', body)

 const notes = []
 if (extraContext) notes.push('page info included')
 if (extraContextImages) notes.push('a screenshot included')
 const suffix = notes.length ? ` (${notes.join(', ')})` : ''
 await new Promise(resolve => setTimeout(resolve, 600))
 return {
  answer: `Demo answer for "${question}"${suffix}. Turn on Live mode to get a grounded answer from the real knowledge service.`,
  // A canned source, so the citation UI can be checked without Live mode too.
  source: { name: 'Sample Document.pdf', page: '1' },
 }
}

/**
 * Real ilDecision:ragAsk call — same body shape as src/services/rag.ts's askKnowledge(), plus the
 * two extra-context fields. opcResources/opcPageNumber are comma-delimited lists, position-aligned
 * with each other (same as the main app) — only the first entry is kept, since this only cites one
 * source, unlike the main app's full source list.
 */
async function liveAnswer(question, extraContext, extraContextImages) {
 const session = await getSession()
 if (!session) throw new Error('Not signed in.')

 const body = buildRequestBody(question, extraContext, extraContextImages, session)
 const response = await fetch(BACKEND_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
 let data = null
 try { data = await response.json() } catch { data = null }
 const rq = data?.rqResponse ?? {}
 if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
 if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
 if (typeof rq.opcResponse !== 'string') throw new Error('The knowledge service returned an invalid response.')
 // Unlike rqErrorMessage, this kind of failure comes back disguised as a normal answer — opcResponse
 // itself holds "REST call failed: <actual message>" instead of the question's real answer, so it
 // has to be caught here rather than relying on the rqErrorMessage/!response.ok checks above.
 const restFailureMatch = rq.opcResponse.match(/^REST call failed:\s*(.*)$/is)
 if (restFailureMatch) {
  console.error('[MiPeers PoC] ragAsk opcResponse reported a REST failure:', restFailureMatch[1].trim())
  throw new Error(friendlyAskError(rq.opcResponse))
 }

 const firstName = typeof rq.opcResources === 'string' ? rq.opcResources.split(',')[0]?.trim() : ''
 const firstPage = typeof rq.opcPageNumber === 'string' ? rq.opcPageNumber.split(',')[0]?.trim() : ''
 const source = firstName ? { name: firstName, page: firstPage || '—' } : null

 return { answer: rq.opcResponse, source }
}

export async function askKnowledge(question, extraContext, extraContextImages) {
 return isLive() ? liveAnswer(question, extraContext, extraContextImages) : demoAnswer(question, extraContext, extraContextImages)
}

/**
 * Some backend errors (e.g. "REST call failed: ...") are implementation details a user can't act
 * on — swap them for a message that tells them what to actually do instead. Other errors here
 * (e.g. "Not signed in.", "The knowledge service is unavailable.") are already hand-written to be
 * user-facing, so they pass through unchanged. Same rule as the main app's friendlyAskError() in
 * src/services/rag.ts.
 */
export function friendlyAskError(message) {
 return /rest call failed/i.test(message)
  ? 'Something went wrong processing that question. Please try again or rephrase it.'
  : message
}
