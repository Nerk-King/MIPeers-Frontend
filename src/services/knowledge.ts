import { computed, ref } from 'vue'
import { documents as sampleDocuments, knowledgeTree, type KnowledgeDocument, type KnowledgeNode } from '../data'
import { localResources, loadLocalResources, resourceDocument } from './uploads'
import { sessionToken } from './auth'
import { withTimeout } from './timeout'
import { isLive } from './liveMode'
import { fetchRagLabels, type RagLabels } from './ragUpload'

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
async function fetchRemoteGroups(signal?: AbortSignal): Promise<RemoteProductGroup[]> {
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
  return parsed
 } catch (e) {
  if (e instanceof DOMException && e.name === 'AbortError' && timeout.didTimeOut()) throw new Error('The knowledge service took too long to respond. Please try again.')
  throw e
 } finally {
  timeout.cleanup()
 }
}

/**
 * The folder structure comes from ilDecision:fetchRagLabelList — each product (label set) is a
 * top-level folder with its labels as subfolders, shown even when empty — and each document from
 * ragKnowledgeBase is filed under its matching product/folder (matched ignoring case, spaces and punctuation, so "Revolving Credit" files under "revolvingcredit"). A
 * document whose product or folder isn't in the label list still gets a folder of its own, so
 * nothing in the knowledge base is hidden.
 */
async function fetchRemoteKnowledgeBase(signal?: AbortSignal): Promise<RemoteKnowledgeBase> {
 // The labels only shape the tree; if they can't be loaded, fall back to folders built from the documents alone.
 const [groups, labels] = await Promise.all([
  fetchRemoteGroups(signal),
  fetchRagLabels().catch((): RagLabels => ({ products: {}, agents: [] })),
 ])

 const tree: KnowledgeNode[] = []
 const matchKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
 const folderNode = (parent: KnowledgeNode[], id: string, name: string): KnowledgeNode[] => {
  let node = parent.find(n => n.type === 'folder' && matchKey(n.name) === matchKey(name))
  if (!node) { node = { id, name, type: 'folder', children: [] }; parent.push(node) }
  return node.type === 'folder' ? node.children : parent
 }
 for (const [product, folders] of Object.entries(labels.products)) {
  const children = folderNode(tree, `kb-product-${product}`, product)
  for (const folder of folders) folderNode(children, `kb-folder-${product}-${folder}`, folder)
 }

 const documents: KnowledgeDocument[] = []
 for (const [groupIndex, group] of groups.entries()) {
  const product = group.product?.trim() || 'Unclassified'
  const productChildren = folderNode(tree, `kb-product-${product}`, product)
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
   const parent = folder ? folderNode(productChildren, `kb-folder-${product}-${folder}`, folder) : productChildren
   parent.push({ id: 'kb-node-' + id, name: entry.fileName || 'Untitled document', type: 'file', documentId: id })
  }
 }
 return { tree, documents }
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

// One shared copy of the knowledge base for every tree on screen (chat rail, library page, drawer).
// It's fetched once per session and reused; refresh with loadKnowledgeBase({ refresh: true }).
const remoteTree = ref<KnowledgeNode[]>([])
export const knowledgeStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
// Each level sorts folders before files, then alphabetically (ignoring case); a folder named
// "General" always goes last among the folders.
function sortTree(nodes: KnowledgeNode[]): KnowledgeNode[] {
 const rank = (node: KnowledgeNode) => node.type === 'file' ? 2 : node.name.trim().toLowerCase() === 'general' ? 1 : 0
 return nodes
  .map(node => node.type === 'folder' ? { ...node, children: sortTree(node.children) } : node)
  .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
}
export const libraryTree = computed<KnowledgeNode[]>(() => [...localTree().map(root => root.type === 'folder' ? { ...root, children: sortTree(root.children) } : root), ...sortTree(isLive.value && sessionToken.value ? remoteTree.value : knowledgeTree)])
let loaded: { key: string; run: number; promise: Promise<void> } | null = null
let runCount = 0

/**
 * Demo samples, or the real knowledge base when live mode is on and a session exists — plus
 * whatever's saved locally in this browser either way. Skips the real call entirely before login
 * (no session yet), same guard as loadHistory() in App.vue — this runs unconditionally from App.vue's
 * root onMounted, including on the login screen, so it must never assume the caller is signed in.
 * Concurrent and repeat calls share one request; only `refresh` forces a new one.
 */
export function loadKnowledgeBase(options: { refresh?: boolean } = {}): Promise<void> {
 const live = isLive.value && !!sessionToken.value
 const key = live ? `live:${sessionToken.value}` : 'demo'
 if (loaded?.key === key && !options.refresh) return loaded.promise
 // Keep showing what's already loaded while a refresh runs; only a library with nothing to show yet shows the loading state.
 const hadData = loaded?.key === key && knowledgeStatus.value === 'ready'
 if (!hadData) knowledgeStatus.value = 'loading'
 // A newer load (refresh, login/logout, live toggle) supersedes this one; its late result is dropped.
 const run = ++runCount
 const promise = (async () => {
  await loadLocalResources()
  if (live) {
   const remote = await fetchRemoteKnowledgeBase()
   if (loaded?.run !== run) return
   remoteDocuments.value = remote.documents
   remoteTree.value = remote.tree
  }
  if (loaded?.run === run) knowledgeStatus.value = 'ready'
 })()
 loaded = { key, run, promise }
 promise.catch(() => {
  if (loaded?.run !== run) return
  loaded = null
  // A failed refresh keeps the library that's already on screen; the next load simply retries.
  if (!hadData) knowledgeStatus.value = 'error'
 })
 return promise
}
