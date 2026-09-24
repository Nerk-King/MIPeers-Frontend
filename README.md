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

## Local knowledge uploads

Knowledge Library → **Upload data** opens a panel with file, folder, link, text,
sitemap, and Q&A inputs. Resources and original file blobs are stored in this
browser's IndexedDB database (`mipeers-library`), not sent to a server. They appear
in the library tree, document count, and search results immediately after saving.
Resource previews support downloading originals/text exports and removing entries.
Folder uploads preserve their directory hierarchy.

Limits: 100 resources per batch, 20 MB per file, 50 MB per file batch, 200,000
characters per text resource, and 2 MB per sitemap XML input. Invalid batches
leave the form available for correction. Files are saved in a single transaction.

Plain-text files have text previews; PDF, Office, and other binary formats retain
their original bytes for download. Links are references. Sitemap XML adds the
listed URLs (up to 100); a sitemap URL or a sitemap-index entry is saved as a
reference and is not recursively fetched. These resources are **not AI-indexed**.
The former placeholder Synchronize action has been replaced by an explicit local
storage notice. Crawling, automatic folder/cloud synchronization, shared access,
and AI indexing need a backend integration.

Clearing this site's browser data removes local uploads. Local resources are
shared within this browser profile's prototype workspace, not isolated by the
demo login. Use downloads to retain copies outside the browser.
