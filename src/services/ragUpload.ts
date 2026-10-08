import { sessionToken } from './auth'
import { withTimeout } from './timeout'
import { isLive } from './liveMode'

export interface UploadResult { fileName: string }

/** Descriptive fields stored alongside the document — product/folder/agent place it in the knowledge base, summary describes it. */
export interface RagUploadMeta { product: string; folder: string; summary: string; agent: string }

// See the matching comment in services/auth.ts: dev runs through Vite's /ils-api proxy (vite.config.ts).
const DEFAULT_UPLOAD_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT || DEFAULT_UPLOAD_ENDPOINT

/** Upload choices from ilDecision:fetchRagLabelList: each product (label set) has its own folders; the "agent" set holds the agents. */
export interface RagLabels { products: Record<string, string[]>; agents: string[] }

const AGENT_LABEL_SET = 'agent'
const DEMO_FOLDERS = ['Business Documents', 'Technical Documents', 'Testing Documents', 'Onboarding Documents']
const DEMO_LABELS: RagLabels = {
 products: { revolvingcredit: DEMO_FOLDERS, drivecash: DEMO_FOLDERS, flexiterm: DEMO_FOLDERS },
 agents: ['Dev', 'Business'],
}

type LabelSet = { LabelSetName?: string; ttLabels?: { LabelName?: string }[] }

export async function fetchRagLabels(): Promise<RagLabels> {
 if (!isLive.value) {
  await new Promise(resolve => setTimeout(resolve, 300))
  return DEMO_LABELS
 }

 const body = {
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:fetchRagLabelList',
 }
 const timeout = withTimeout(undefined, 45000)
 try {
  const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: timeout.signal })
  let data: { rqResponse?: { rqErrorMessage?: string; oplSuccess?: boolean; dsLabelSet?: { ttLabelSet?: LabelSet[] } } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok || rq.oplSuccess === false) throw new Error('Could not load the product and folder lists. Please try again.')

  const labels: RagLabels = { products: {}, agents: [] }
  for (const set of rq.dsLabelSet?.ttLabelSet ?? []) {
   const name = set.LabelSetName?.trim()
   if (!name) continue
   const values = (set.ttLabels ?? []).map(label => label.LabelName?.trim() ?? '').filter(Boolean)
   if (name.toLowerCase() === AGENT_LABEL_SET) labels.agents = values
   else labels.products[name] = values
  }
  return labels
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The label service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
 pdf: 'application/pdf',
 doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml',
 html: 'text/html', htm: 'text/html', md: 'text/markdown',
 png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
 zip: 'application/zip',
}

/** Falls back to a simple extension lookup when the browser doesn't supply a MIME type (file.type is often empty for some formats). */
export function inferContentType(file: File): string {
 if (file.type) return file.type
 const ext = file.name.split('.').pop()?.toLowerCase() || ''
 return EXTENSION_CONTENT_TYPES[ext] || 'application/octet-stream'
}

/** Reads a file as plain base64 (no "data:...;base64," prefix). */
function fileToBase64(file: File): Promise<string> {
 return new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
   const result = reader.result as string
   resolve(result.slice(result.indexOf(',') + 1))
  }
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
  reader.readAsDataURL(file)
 })
}

/**
 * Calls ilDecision:ragUpload to have the backend ingest a file. The file's bytes travel in the
 * request itself — base64-encoded in pcFilePath — so the browser needs no local folder access and
 * this works from a plain http:// origin.
 */
export async function ragUpload(file: File, meta: RagUploadMeta): Promise<UploadResult> {
 if (!isLive.value) {
  await new Promise(resolve => setTimeout(resolve, 600))
  return { fileName: file.name }
 }

 const body = {
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:ragUpload',
  pcFilePath: await fileToBase64(file),
  pcFileName: file.name,
  pcContentType: inferContentType(file),
  pcProduct: meta.product.trim(),
  pcFolder: meta.folder.trim(),
  pcSummary: meta.summary.trim(),
  pcAgent: meta.agent.trim(),
 }
 // Larger than the other calls' 45s: the whole file goes up in this one request.
 const timeout = withTimeout(undefined, 120000)
 try {
  const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: timeout.signal })
  // Same backend family as auth.ts/rag.ts: error details come back in the JSON body even on a
  // non-2xx status, so parse the body before deciding whether to give up on !response.ok.
  let data: { rqResponse?: { rqErrorMessage?: string; oplSuccess?: boolean } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('The upload service is unavailable. Please try again.')
  if (rq.oplSuccess === false) throw new Error('The upload service could not ingest this file.')
  return { fileName: file.name }
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The upload service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}
