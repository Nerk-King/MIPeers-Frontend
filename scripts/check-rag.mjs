import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source = (await fs.readFile(new URL('../src/services/rag.ts', import.meta.url), 'utf8')).replaceAll('import.meta.env.VITE_RAG_ENDPOINT', "''")
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { askKnowledge, demoMode } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
assert.equal(demoMode, true)
for (const [question, expected] of [['Settlement rules', 'policy'], ['OAuth API', 'api'], ['Product features', 'manual']]) {
 const response = await askKnowledge({ question, agentId: 'general', history: [] })
 assert.ok(response.answer.length > 30)
 assert.ok(response.sourceIds.includes(expected))
}
const controller = new AbortController(); controller.abort()
await assert.rejects(askKnowledge({ question: 'test', agentId: 'general', history: [] }, controller.signal), { name: 'AbortError' })
console.log('Demo adapter: settlement, integration, general answer, and cancellation checks passed.')
