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
 return new Promise(resolve => setTimeout(() => resolve(
  `Demo answer for "${question}"${suffix}. Turn on Live mode to get a grounded answer from the real knowledge service.`
 ), 600))
}

/** Real ilDecision:ragAsk call — same body shape as src/services/rag.ts's askKnowledge(), plus the two extra-context fields. */
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
 return rq.opcResponse
}

export async function askKnowledge(question, extraContext, extraContextImages) {
 return isLive() ? liveAnswer(question, extraContext, extraContextImages) : demoAnswer(question, extraContext, extraContextImages)
}
