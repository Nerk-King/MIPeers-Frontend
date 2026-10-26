# MiPeers Page Assistant (proof-of-concept browser extension)

A standalone Chrome/Edge extension that lets you ask your MiPeers knowledge base a question from a
popup. This is a proof-of-concept, built deliberately isolated from the main app:

- Plain, unbundled files (manifest + HTML/CSS/JS, using native ES modules — no build step) —
  nothing here is referenced by `vite.config.ts`, `tsconfig.json`, or anything under `src/`, and
  nothing under `src/` is referenced here.
- Deleting this `extension/` folder has zero effect on `npm run dev`, `npm run build`, or any
  existing functionality in the main app.

## Try it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `extension/` folder.
4. Click the MiPeers icon in the toolbar, sign in, ask a question.

## Theming

A sun/moon toggle in the header switches between dark (default) and light theme, persisted to
`localStorage` (`config.js`'s `getTheme()`/`setTheme()`) and applied via a `data-theme` attribute on
`<html>` — same pattern as the main app's `theme.css`, just with CSS custom properties here instead
(`popup.css`'s `:root` / `:root[data-theme="light"]`) since this is plain CSS, not Vue.

The popup's visible chrome (background, padding, rounded corners) all lives on a `.popup-shell`
wrapper div, not `body` — `html`/`body` are transparent, which is what lets the rounded corners
show as the actual popup window's edge rather than being clipped square by it.

## Login is required first

The popup always shows the login screen before the ask-a-question view — there's no way to ask a
question without signing in first, in either mode.

A Demo/Live pill in the header mirrors the main app's toggle, defaulting to **Demo**. In Demo mode,
*signing in* is also simulated locally (`auth.js`'s `login()`, same rule as the main app's demo-mode
`requestLogin()`: any non-empty username and a password of 4+ characters succeeds) — no network call
at all, and asking a question returns a canned response (`rag.js`'s `demoAnswer()`).

Switching to **Live** calls the real `ilRest:getUserStaffNo` login service for signing in, and the
real `ilDecision:ragAsk` service for questions (`rag.js`'s `liveAnswer()`) — same request shape as
`src/services/rag.ts`'s `askKnowledge()` (`pcQuery`, `pcTitle`, `pcContext`, `pcFilter`,
`piTopResult`), plus two fields the main app doesn't use: `pcExtraContext` and
`pcExtraContextImages` (see "Page context" below). Switching the Demo/Live toggle clears any
existing session, since a Demo session token is meaningless to the real backend (and vice versa) —
you'll always need to sign in again right after switching modes.

Extension background/popup scripts aren't bound by a page's CORS restrictions the way this app's
dev-only `/ils-api` Vite proxy exists to work around — with `host_permissions` declared in
`manifest.json` (already done, for the real backend host), the extension can call the real endpoint
directly, no proxy needed.

The "MiPeers" title in the header is a link to the real app (`http://il-lnx1:8080/mipeers/#/login`),
opening in a new tab.

## Page context

Two checkboxes above the chat log control what rides along with a question, both feeding
`ilDecision:ragAsk` fields the main app doesn't use:

- **"Include this page's info"** (`pcExtraContext`, default on) — the current tab's title, URL,
  any selected text, and a text excerpt, read via `content-script.js` (injected only when the popup
  opens, not a persistent content script) and formatted as plain text (`popup.js`'s
  `formatExtraContext()`).
- **"Include a screenshot of this page"** (`pcExtraContextImages`, default off) — a screenshot of
  the visible tab via `chrome.tabs.captureVisibleTab()` (`popup.js`'s `captureScreenshot()`), sent as
  raw base64 (the `data:image/png;base64,` prefix stripped). This only captures the visible
  viewport, not the full scrollable page — stitching together a full-page screenshot would need
  extra scroll-and-capture logic this doesn't do yet.

By default, both boxes reset (unchecked, screenshot/page-info preview cleared) after every question
— to optimize requests, context is one-shot rather than silently resent (and going stale) on
follow-up questions unless deliberately re-ticked. A third checkbox, **"Always send this with every
question"**, flips that: when it's on, both boxes stay checked across questions instead of resetting
(`config.js`'s `getAlwaysIncludeContext()`/`setAlwaysIncludeContext()`, persisted like the other
toggles; `popup.js`'s `resetContextAfterAsk()` is the one place that checks it).

Both fields are arrays, one element each for now since this only ever captures one page's info and
one screenshot at a time — but sent as LONGCHAR (JSON-stringified text, not native nested JSON in
the request body), same convention as `opcDocuments` elsewhere in this codebase (`knowledge.ts`):
the backend parses the string back into an array/object server-side. `pcExtraContext`, once parsed,
is an array of strings; each `pcExtraContextImages` element, once parsed, is `{ content_type,
b64encoded }` — `content_type` is always `"image/png"` here since that's the format requested from
`chrome.tabs.captureVisibleTab()`. Built in `rag.js`'s `buildRequestBody()`.

## Known limitations / TODOs

- **Session storage**: `chrome.storage.session` (`auth.js`, needs the `"storage"` permission). Not
  `localStorage` — that would survive a full browser restart, and not `chrome.storage.local` either
  (same problem, just also reachable from a background worker). `.session` is the one storage area
  that's actually cleared when the browser closes, which is the whole point of a login session
  expiring. It still persists across popup open/close and across tabs within the same browser
  session, same as `localStorage` did. If a background worker is ever added, `.session` already
  covers the original reason to consider `chrome.storage` at all (a worker has no DOM, so it can't
  reach `localStorage`) — nothing further to migrate.
- Chat history is in-memory only (DOM, not any storage) — already cleared on every popup close/
  reopen as a side effect of that, and explicitly cleared on sign-out/mode-switch too
  (`popup.js`'s `clearChatLog()`). No multi-turn conversation either way — each question is
  independent, no history is kept or sent.
- One source citation per answer (`rag.js`'s `liveAnswer()` parses `rq.opcResources`/
  `opcPageNumber`, same comma-delimited/position-aligned fields the main app uses, but only keeps
  the first entry — the main app shows the full list, this popup shows just one). Demo mode shows a
  canned source too, so the citation UI can be checked without Live mode.

## Icons

`icon16/48/128.png` are a simplified redraw of the robot mascot from `src/components/AgentAvatar.vue`
(same palette/shapes), generated by `scripts/make_icons.py` since no SVG-to-PNG tool was available
in the environment that built this to rasterize the real SVG directly. Needs Python + Pillow
(`pip install pillow`) to regenerate — not part of any build step, just a one-off script.
