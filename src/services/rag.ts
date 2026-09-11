export interface RagRequest { question: string; agentId: string; history: { role: string; content: string }[] }
export interface RagResponse { answer: string; sourceIds: string[] }
export const demoMode = !import.meta.env.VITE_RAG_ENDPOINT
/** Replace this adapter with your Progress Agentic RAG backend contract. Secrets stay server-side. */
export async function askKnowledge(request: RagRequest, signal?: AbortSignal): Promise<RagResponse> {
 if (!demoMode) {
  const response = await fetch(import.meta.env.VITE_RAG_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal })
  if (!response.ok) throw new Error('The knowledge service is unavailable. Please try again.')
  const data = await response.json()
  if (typeof data.answer !== 'string' || !Array.isArray(data.sourceIds) || !data.sourceIds.every((id: unknown) => typeof id === 'string')) throw new Error('The knowledge service returned an invalid response.')
  return data
 }
 await new Promise(resolve => setTimeout(resolve, 850))
 if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
 if (/settle|holiday|clearing/i.test(request.question)) return { answer: 'Settlement guidance brings together the policy, operating procedures, and business calendar. Here are the areas to check:\n\n1. Settlement timeline — confirm the applicable cycle for the product and market.\n2. Cut-off times — review the deadline for submitting and amending instructions.\n3. Required instructions — validate the details before processing.\n4. Exceptions — follow the escalation procedure for failed or delayed settlements.\n5. Holidays — check the relevant business calendar for date adjustments.\n\nOpen the sources below to explore the sample documents. This is a demo answer, not verified operational guidance.', sourceIds: ['policy', 'procedures', 'calendar'] }
 if (/api|oauth|code|integrat/i.test(request.question)) return { answer: 'Start with the API Integration Guide to explore the integration workflow. A typical implementation authenticates through your application backend, sends the question and conversation context, and returns an answer with source references.\n\nThe frontend already has a dedicated service adapter for that handoff. Your backend can handle authentication and the Progress Agentic RAG connection.\n\nThis is a sample response; connect your knowledge service for answers grounded in your documentation.', sourceIds: ['api', 'manual'] }
 return { answer: `Here is a starting point for “${request.question}”.\n\nUse the knowledge library to explore product documentation and policies, or choose a specialist agent to narrow your question. You can open source references, ask a follow-up, and bookmark useful answers.\n\nThis workspace is currently in demo mode. Once connected, your knowledge service will generate a grounded answer here using your organization's documents.`, sourceIds: ['manual'] }
}
