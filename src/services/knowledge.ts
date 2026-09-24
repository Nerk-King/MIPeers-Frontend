import { computed, ref } from 'vue'
import { documents as sampleDocuments, knowledgeTree, type KnowledgeDocument, type KnowledgeNode } from '../data'
import { localResources, loadLocalResources, resourceDocument } from './uploads'

export interface KnowledgeTreeResponse { tree: KnowledgeNode[]; documents: KnowledgeDocument[] }
export const knowledgeDemoMode = !import.meta.env.VITE_KNOWLEDGE_ENDPOINT
const remoteDocuments = ref<KnowledgeDocument[]>(knowledgeDemoMode ? sampleDocuments : [])
export const libraryDocuments = computed(() => [...remoteDocuments.value, ...localResources.value.map(resourceDocument)])

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

/** Remote catalogue (or samples) plus resources saved in this browser. */
export async function getKnowledgeTree(signal?: AbortSignal): Promise<KnowledgeTreeResponse> {
 await loadLocalResources()
 let tree = knowledgeTree
 if (!knowledgeDemoMode) {
  const response = await fetch(import.meta.env.VITE_KNOWLEDGE_ENDPOINT, { signal })
  if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
  const data = await response.json()
  if (!Array.isArray(data.tree) || !Array.isArray(data.documents)) throw new Error('The knowledge service returned an invalid response.')
  tree = data.tree
  remoteDocuments.value = data.documents
 }
 if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
 return { tree: [...localTree(), ...tree], documents: libraryDocuments.value }
}
