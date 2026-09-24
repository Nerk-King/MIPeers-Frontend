import { ref } from 'vue'
import type { KnowledgeDocument } from '../data'

export type UploadSource = 'file' | 'folder' | 'links' | 'text' | 'sitemap' | 'qa'
export type LocalResource = {
 id: string
 source: UploadSource
 name: string
 path: string
 content: string
 createdAt: string
 file?: Blob
 url?: string
}
export const localResources = ref<LocalResource[]>([])
export const uploadRevision = ref(0)
export const MAX_FILE_SIZE = 20 * 1024 * 1024
export const MAX_BATCH_SIZE = 50 * 1024 * 1024
export const MAX_RESOURCES = 100
export const MAX_TEXT_LENGTH = 200_000
let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
 if (!database) database = new Promise((resolve, reject) => {
  const request = indexedDB.open('mipeers-library', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('resources', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => { database = undefined; reject(new Error('Local storage is unavailable. Allow browser storage and try again.')) }
  request.onblocked = () => { database = undefined; reject(new Error('Close other MiPeers tabs and try again.')) }
 })
 return database
}

export async function loadLocalResources() {
 const db = await openDatabase()
 const entries = await new Promise<LocalResource[]>((resolve, reject) => {
  const request = db.transaction('resources', 'readonly').objectStore('resources').getAll()
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Could not read your local library. Please try again.'))
 })
 localResources.value = entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
 return localResources.value
}

export function resourceDocument(resource: LocalResource): KnowledgeDocument {
 return {
  id: resource.id, name: resource.name, category: 'Local uploads',
  folder: resource.path || sourceLabels[resource.source], pages: '—',
  date: new Date(resource.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
  content: resource.content,
 }
}
export const sourceLabels: Record<UploadSource, string> = {
 file: 'Files', folder: 'Folders', links: 'Links', text: 'Text resources', sitemap: 'Sitemaps', qa: 'Q&A',
}
export function httpUrl(value: string): string {
 let url: URL
 try { url = new URL(value.trim()) } catch { throw new Error('Enter a complete URL beginning with https:// or http://.') }
 if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without a username or password.')
 return url.href
}

export function createResource(source: UploadSource, name: string, content: string, extra: Partial<Pick<LocalResource, 'file' | 'url' | 'path'>> = {}): LocalResource {
 if (!name.trim()) throw new Error('Give this resource a title.')
 if (!content.trim()) throw new Error('Add content before saving.')
 if (content.length > MAX_TEXT_LENGTH) throw new Error('Keep each text resource under 200,000 characters.')
 return { id: 'upload-' + crypto.randomUUID(), source, name: name.trim().slice(0, 200), content, createdAt: new Date().toISOString(), path: sourceLabels[source], ...extra }
}

export async function fileResources(files: File[], source: 'file' | 'folder'): Promise<LocalResource[]> {
 if (!files.length) throw new Error('Choose at least one file.')
 if (files.length > MAX_RESOURCES) throw new Error('Choose up to 100 files at a time.')
 if (files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_SIZE) throw new Error('Keep each upload below 50 MB.')
 for (const file of files) {
  if (file.size > MAX_FILE_SIZE) throw new Error(file.name + ' exceeds the 20 MB per-file limit.')
  if (!file.size) throw new Error(file.name + ' is empty. Remove it before saving.')
 }
 return Promise.all(files.map(async file => {
  const textFile = /\.(txt|md|csv|json|xml|html?|log|ya?ml|ts|js|css)$/i.test(file.name) || file.type.startsWith('text/')
  const content = textFile
   ? (await file.slice(0, MAX_TEXT_LENGTH).text()) + (file.size > MAX_TEXT_LENGTH ? '\n\n[Preview shortened. Download the original to see the complete file.]' : '')
   : 'Original file saved in this browser. Download it to view its contents. Text extraction and AI indexing require a connected knowledge service.'
  return createResource(source, file.name, content.slice(0, MAX_TEXT_LENGTH), {
   file, path: source === 'folder' ? file.webkitRelativePath.split('/').slice(0, -1).join('/') || 'Folders' : 'Files',
  })
 }))
}

export function linkResources(value: string): LocalResource[] {
 const urls = [...new Set(value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(httpUrl))]
 if (!urls.length) throw new Error('Enter at least one URL.')
 if (urls.length > MAX_RESOURCES) throw new Error('Add up to 100 links at a time.')
 return urls.map(url => createResource('links', url, url + '\n\nSaved as a reference. Website content has not been downloaded or indexed.', { url }))
}

export function sitemapResources(value: string): LocalResource[] {
 if (!value.trim()) throw new Error('Paste a sitemap URL or its XML contents.')
 if (!value.trim().startsWith('<')) {
  const url = httpUrl(value)
  return [createResource('sitemap', new URL(url).hostname + ' sitemap', url + '\n\nSitemap reference saved. Paste or import its XML to add individual page links. Automatic crawling requires a connected service.', { url })]
 }
 if (value.length > 2_000_000) throw new Error('Use a sitemap XML file smaller than 2 MB.')
 const xml = new DOMParser().parseFromString(value, 'application/xml')
 if (xml.querySelector('parsererror') || !['urlset', 'sitemapindex'].includes(xml.documentElement.localName)) throw new Error('Use valid sitemap XML with a urlset or sitemapindex root.')
 const urls = [...new Set(Array.from(xml.getElementsByTagNameNS('*', 'loc')).map(node => httpUrl(node.textContent || '')))]
 if (!urls.length) throw new Error('This sitemap contains no URLs.')
 if (urls.length > MAX_RESOURCES) throw new Error('This sitemap has more than 100 entries. Import a smaller sitemap.')
 const isIndex = xml.documentElement.localName === 'sitemapindex'
 return urls.map(url => createResource('sitemap', url, url + (isIndex ? '\n\nChild sitemap reference saved. Import its XML to add page links.' : '\n\nPage reference imported from a sitemap. Website content has not been downloaded or indexed.'), { url }))
}

export async function saveResources(resources: LocalResource[]) {
 if (!resources.length || resources.length > MAX_RESOURCES) throw new Error('Save between 1 and 100 resources at a time.')
 const db = await openDatabase()
 await new Promise<void>((resolve, reject) => {
  const transaction = db.transaction('resources', 'readwrite')
  const store = transaction.objectStore('resources')
  resources.forEach(resource => store.add(resource))
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(new Error('Could not save these resources. Browser storage may be full. Remove older uploads or free space and try again.'))
  transaction.onabort = () => reject(new Error('The upload was not saved. Check available browser storage and try again.'))
 })
 // Commit to the visible library only after the entire batch is safely stored.
 const ids = new Set(resources.map(resource => resource.id))
 localResources.value = [...localResources.value.filter(resource => !ids.has(resource.id)), ...resources]
 uploadRevision.value++
}

export async function removeResource(id: string) {
 const db = await openDatabase()
 await new Promise<void>((resolve, reject) => {
  const transaction = db.transaction('resources', 'readwrite')
  transaction.objectStore('resources').delete(id)
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(new Error('Could not remove this resource. Please try again.'))
 })
 localResources.value = localResources.value.filter(resource => resource.id !== id)
 uploadRevision.value++
}

export function downloadResource(id: string) {
 const resource = localResources.value.find(item => item.id === id)
 if (!resource) throw new Error('This local resource is no longer available.')
 const url = URL.createObjectURL(resource.file || new Blob([resource.content], { type: 'text/plain;charset=utf-8' }))
 const anchor = document.createElement('a')
 anchor.href = url
 anchor.download = resource.file ? resource.name : resource.name.replace(/[^a-zA-Z0-9 _.-]/g, '_') + '.txt'
 document.body.append(anchor)
 anchor.click()
 anchor.remove()
 setTimeout(() => URL.revokeObjectURL(url), 1000)
}
