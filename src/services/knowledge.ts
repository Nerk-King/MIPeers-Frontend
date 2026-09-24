import { documents, knowledgeTree, type KnowledgeDocument, type KnowledgeNode } from '../data'

export interface KnowledgeTreeResponse { tree: KnowledgeNode[]; documents: KnowledgeDocument[] }

export const knowledgeDemoMode = !import.meta.env.VITE_KNOWLEDGE_ENDPOINT

/**
 * Replace this adapter with your Progress Agentic RAG knowledge-base browsing endpoint.
 * It should return the folder/file tree (see KnowledgeNode in src/data.ts) plus the flat
 * document metadata referenced by each file node's documentId. Keep credentials server-side.
 */
export async function getKnowledgeTree(signal?: AbortSignal): Promise<KnowledgeTreeResponse> {
 if (!knowledgeDemoMode) {
  const response = await fetch(import.meta.env.VITE_KNOWLEDGE_ENDPOINT, { signal })
  if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
  const data = await response.json()
  if (!Array.isArray(data.tree) || !Array.isArray(data.documents)) throw new Error('The knowledge service returned an invalid response.')
  return data
 }
 await new Promise(resolve => setTimeout(resolve, 300))
 if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
 return { tree: knowledgeTree, documents }
}
