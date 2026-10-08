import { computed, ref } from 'vue'
import { documents as sampleDocuments, knowledgeTree, type KnowledgeDocument, type KnowledgeNode } from '../data'
import { localResources, loadLocalResources, resourceDocument } from './uploads'
import { sessionToken } from './auth'
import { withTimeout } from './timeout'
import { isLive } from './liveMode'

export interface KnowledgeTreeResponse { tree: KnowledgeNode[]; documents: KnowledgeDocument[] }

// See the matching comment in services/auth.ts: dev runs through Vite's /ils-api proxy (vite.config.ts).
const DEFAULT_KNOWLEDGE_ENDPOINT = import.meta.env.DEV ? '/ils-api/web_pvtken/rest.w' : 'https://mn2503.ils.mip.co.za/web_pvtken/rest.w'
const KNOWLEDGE_ENDPOINT = import.meta.env.VITE_KNOWLEDGE_ENDPOINT || DEFAULT_KNOWLEDGE_ENDPOINT

const remoteDocuments = ref<KnowledgeDocument[]>([])
export const libraryDocuments = computed(() => [...(isLive.value && sessionToken.value ? remoteDocuments.value : sampleDocuments), ...localResources.value.map(resourceDocument)])

function localTree(): KnowledgeNode[] {
 if (!localResources.value.length) return []
 const root: KnowledgeNode = { id: 'local-uploads', name: 'Local uploads · this browser', type: 'folder', children: [] }
 for (const resource of localResources.value) {
  let parent = root
  const parts = resource.path.split('/').filter(Boolean)
  let path = ''
  for (const part of parts) {
   path += '/' + part
   const id = 'local-folder-' + path
   let child = parent.children.find(node => node.id === id)
   if (!child) { child = { id, name: part, type: 'folder', children: [] }; parent.children.push(child) }
   if (child.type === 'folder') parent = child
  }
  parent.children.push({ id: 'local-file-' + resource.id, name: resource.name, type: 'file', documentId: resource.id })
 }
 return [root]
}

interface RemoteFile { fileName?: string; summary?: string; status?: string; folder?: string; downloadLink?: string }
interface RemoteProductGroup { product?: string; files?: RemoteFile[] }
interface RemoteKnowledgeBase { tree: KnowledgeNode[]; documents: KnowledgeDocument[] }

/**
 * Calls ilDecision:ragKnowledgeBase for the documents indexed in the real knowledge base, grouped by
 * product. opcDocuments is itself a JSON-encoded string — [{product, files: [{fileName, summary,
 * status, folder, downloadLink}]}] — so it needs a second JSON.parse after the envelope. A standard
 * JSON.parse already resolves the escaped slashes correctly; the extra replace is just a defensive
 * fallback in case a response ever arrives double-escaped.
 */
async function fetchRemoteKnowledgeBase(signal?: AbortSignal): Promise<RemoteKnowledgeBase> {
 const params = new URLSearchParams({
  rqDataMode: 'VAR/JSON',
  rqAuthentication: `Session:${sessionToken.value}`,
  rqService: 'ilDecision:ragKnowledgeBase',
 })
 const timeout = withTimeout(signal, 45000)
 try {
  const response = await fetch(`${KNOWLEDGE_ENDPOINT}?${params.toString()}`, { signal: timeout.signal })
  let data: { rqResponse?: { rqErrorMessage?: string; opcDocuments?: string } } | null = null
  try { data = await response.json() } catch { data = null }
  const rq = data?.rqResponse ?? {}
  if (typeof rq.rqErrorMessage === 'string' && rq.rqErrorMessage) throw new Error(rq.rqErrorMessage)
  if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
  if (typeof rq.opcDocuments !== 'string') throw new Error('The knowledge service returned an invalid response.')

  let parsed: RemoteProductGroup[]
  try { parsed = JSON.parse(rq.opcDocuments) }
  catch { parsed = JSON.parse(rq.opcDocuments.replace(/\\\//g, '/')) }
  if (!Array.isArray(parsed)) throw new Error('The knowledge service returned an invalid response.')

  // Each product becomes a top-level folder; a file's own folder (when set) nests beneath it.
  const documents: KnowledgeDocument[] = []
  const tree: KnowledgeNode[] = parsed.map((group, groupIndex) => {
   const product = group.product?.trim() || 'Unclassified'
   const productNode: KnowledgeNode = { id: `kb-product-${groupIndex}`, name: product, type: 'folder', children: [] }
   for (const [fileIndex, entry] of (group.files ?? []).entries()) {
    const id = `kb-${groupIndex}-${fileIndex}`
    const folder = entry.folder?.trim() || ''
    const failed = entry.status?.toUpperCase() === 'ERROR'
    documents.push({
     id,
     name: entry.fileName || 'Untitled document',
     category: product,
     folder,
     pages: '—',
     date: '',
     content: entry.summary?.trim() || (failed ? 'This document failed to process and is not available to the agents.' : 'No summary available for this document.'),
     downloadLink: entry.downloadLink || undefined,
    })
    let parent = productNode
    if (folder) {
     const folderId = `kb-folder-${groupIndex}-${folder}`
     let folderNode = parent.children.find(node => node.id === folderId)
     if (!folderNode) { folderNode = { id: folderId, name: folder, type: 'folder', children: [] }; parent.children.push(folderNode) }
     if (folderNode.type === 'folder') parent = folderNode
    }
    parent.children.push({ id: 'kb-node-' + id, name: entry.fileName || 'Untitled document', type: 'file', documentId: id })
   }
   return productNode
  })
  return { tree, documents }
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The knowledge service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

// Dev/preview proxy that adds the RAG service-account key server-side (see ragProxy in vite.config.ts).
const RAG_DOWNLOAD_BASE = import.meta.env.VITE_RAG_DOWNLOAD_BASE || '/rag-api'

/**
 * Downloads a knowledge-base file. The downloadLink points straight at the RAG API, which rejects
 * anonymous requests, so only its /api/v1/... path is kept and the request goes through the proxy.
 */
export async function downloadKnowledgeDocument(doc: KnowledgeDocument, signal?: AbortSignal): Promise<void> {
 const path = doc.downloadLink?.match(/\/?api\/v1\/.*/)?.[0]
 if (!path) throw new Error('This document has no download link.')
 const timeout = withTimeout(signal, 60000)
 try {
  const response = await fetch(RAG_DOWNLOAD_BASE + (path.startsWith('/') ? path : '/' + path), { signal: timeout.signal })
  // Without RAG_API_ORIGIN set, the dev server's SPA fallback answers with index.html instead of a 404.
  if (response.ok && response.headers.get('content-type')?.includes('text/html')) throw new Error('Downloads are not configured. Set RAG_API_ORIGIN and RAG_API_KEY in .env and restart the dev server.')
  if (response.status === 401 || response.status === 403) throw new Error('The knowledge base rejected the download. Check RAG_API_KEY in .env and restart the dev server.')
  if (!response.ok) throw new Error('Unable to download this document. Please try again.')
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = doc.name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The download took too long. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

/**
 * Demo samples, or the real knowledge base when live mode is on and a session exists — plus
 * whatever's saved locally in this browser either way. Skips the real call entirely before login
 * (no session yet), same guard as loadHistory() in App.vue — this runs unconditionally from App.vue's
 * root onMounted, including on the login screen, so it must never assume the caller is signed in.
 */
export async function getKnowledgeTree(signal?: AbortSignal): Promise<KnowledgeTreeResponse> {
 await loadLocalResources()
 let tree: KnowledgeNode[] = knowledgeTree
 if (isLive.value && sessionToken.value) {
  const remote = await fetchRemoteKnowledgeBase(signal)
  remoteDocuments.value = remote.documents
  tree = remote.tree
 }
 if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
 return { tree: [...localTree(), ...tree], documents: libraryDocuments.value }
}
