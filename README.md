# MiPeers knowledge workspace

Vue 3 + TypeScript + Vite frontend based on the supplied MiP screenshots.

## Run locally

Use Node.js 22.12+ and pnpm. Run `pnpm install`, then `pnpm dev`. Run `pnpm build` for the type-checked production build, or `pnpm preview` to serve the build.

## Screens and interactions

- Home: question composer and suggested prompts.
- Dashboard: multi-turn demo chat, agent selection, answer copying, helpful feedback, bookmarks, citations, and new conversations.
- AI Agents: select a specialist and start a conversation.
- Knowledge Library: searchable sample documents, expandable folders, and document previews.
- History: reopen and delete conversations.
- Bookmarks: revisit or remove saved answers.
- Settings: display name, compact navigation, source-panel preference.

Navigation uses hash routes to work on static hosts. Conversations and preferences are stored only in this browser's localStorage. This is a frontend prototype, not a multi-user authenticated application. Documents are illustrative text previews, not the original PDF/DOCX files. The MiP wordmark is a CSS/text approximation pending official assets.

## Progress Agentic RAG integration

`src/services/rag.ts` is the integration boundary. Set `VITE_RAG_ENDPOINT` in `.env` to your application backend URL. Restart the dev server after changing environment variables. Without it, the adapter returns explicitly labelled sample responses.

Request: `POST` JSON `{ question, agentId, history: [{ role, content }] }`.

Response: `{ answer: string, sourceIds: string[] }`.

Source IDs currently reference `src/data.ts`; replace that catalogue with your backend's document metadata and retrieval endpoint when connecting real sources. Add streaming and cancellation to this adapter when the backend contract is agreed. Keep RAG credentials and authorization enforcement server-side; VITE-prefixed values are public client configuration.

## Verification

The production build checks Vue templates and TypeScript. The demo adapter can be exercised using `node scripts/check-rag.mjs`. Browser interaction/visual testing is still a separate validation step.
