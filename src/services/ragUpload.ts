import { sessionToken } from './auth'
import { withTimeout } from './timeout'
import { isLive } from './liveMode'

export interface UploadResult { fileName: string; path: string }

// See the matching comment in services/auth.ts: dev runs through Vite's /ils-api proxy (vite.config.ts).
const DEFAULT_UPLOAD_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT || DEFAULT_UPLOAD_ENDPOINT

/**
 * "I:\..." (the locally configured path) -> "/u1/shares/ils/..." (the same shared drive, as the
 * AppServer sees it) — only the "I:" prefix is replaced (this is a specific mapped-drive convention,
 * not a generic drive-letter rule), backslashes become forward slashes, and the filename is appended.
 */
export function toServerFilePath(localBasePath: string, fileName: string): string {
 const path = localBasePath.trim().replace(/^[Ii]:/, '/u1/shares/ils').replace(/\\/g, '/').replace(/\/+$/, '')
 return `${path}/${fileName}`
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

/**
 * Calls ilDecision:ragUpload to have the backend ingest a file. This call carries no file bytes —
 * it just tells the AppServer where to read a file it can already see on the shared drive. The
 * caller is responsible for actually placing the file at that path first (see services/localFs.ts).
 */
export async function ragUpload(localBasePath: string, file: File): Promise<UploadResult> {
 const filePath = toServerFilePath(localBasePath, file.name)
 if (!isLive.value) {
  await new Promise(resolve => setTimeout(resolve, 600))
  return { fileName: file.name, path: filePath }
 }

 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:ragUpload',
  pcFilePath: filePath,
  pcFileName: file.name,
  pcContentType: inferContentType(file),
 })
 const timeout = withTimeout(undefined, 45000)
 try {
  const response = await fetch(`${UPLOAD_ENDPOINT}?${params.toString()}`, { signal: timeout.signal })
  // Same backend family as auth.ts/rag.ts: error details come back in the JSON body even on a
  // non-2xx status, so parse the body before deciding whether to give up on !response.ok.
  let data: { rqResponse?: { rqErrorMessage?: string } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('The upload service is unavailable. Please try again.')
  return { fileName: file.name, path: filePath }
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The upload service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}
