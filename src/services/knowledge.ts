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
export const libraryDocuments = computed(() => [...(isLive.value ? remoteDocuments.value : sampleDocuments), ...localResources.value.map(resourceDocument)])

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

/**
 * Calls ilDecision:ragKnowledgeBase for the flat list of documents indexed in the real knowledge
 * base. opcDocuments is itself a JSON-encoded string — [{fileName, summary, downloadLink}] — so it
 * needs a second JSON.parse after the envelope. A standard JSON.parse already resolves the escaped
 * slashes correctly; the extra replace is just a defensive fallback in case a response ever arrives
 * double-escaped.
 */
async function fetchRemoteKnowledgeBase(signal?: AbortSignal): Promise<KnowledgeDocument[]> {
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

  let parsed: { fileName?: string; summary?: string; downloadLink?: string }[]
  try { parsed = JSON.parse(rq.opcDocuments) }
  catch { parsed = JSON.parse(rq.opcDocuments.replace(/\\\//g, '/')) }

  return parsed.map((entry, index) => ({
   id: 'kb-' + index,
   name: entry.fileName || 'Untitled document',
   category: 'Knowledge Base',
   folder: '',
   pages: '—',
   date: '',
   content: entry.summary?.trim() || 'No summary available for this document.',
   downloadLink: entry.downloadLink || undefined,
  }))
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The knowledge service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

/** Demo samples, or the real knowledge base when live mode is on — plus whatever's saved locally in this browser either way. */
export async function getKnowledgeTree(signal?: AbortSignal): Promise<KnowledgeTreeResponse> {
 await loadLocalResources()
 let tree: KnowledgeNode[] = knowledgeTree
 if (isLive.value) {
  remoteDocuments.value = await fetchRemoteKnowledgeBase(signal)
  // The knowledge base has no folder structure of its own, so these sit as a flat file list.
  tree = remoteDocuments.value.map(doc => ({ id: 'kb-node-' + doc.id, name: doc.name, type: 'file', documentId: doc.id }))
 }
 if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
 return { tree: [...localTree(), ...tree], documents: libraryDocuments.value }
}
