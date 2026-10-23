import { getSession, clearSession, login } from './auth.js'
import { askKnowledge } from './rag.js'
import { isLive, setLive, getTheme, setTheme } from './config.js'

const themeToggle = document.getElementById('theme-toggle')
const liveToggle = document.getElementById('live-toggle')
const liveToggleLabel = document.getElementById('live-toggle-label')
const loginView = document.getElementById('login-view')
const mainView = document.getElementById('main-view')
const usernameEl = document.getElementById('username')
const passwordEl = document.getElementById('password')
const loginSubmit = document.getElementById('login-submit')
const loginError = document.getElementById('login-error')
const sessionNameEl = document.getElementById('session-name')
const signOutButton = document.getElementById('sign-out')
const pageInfoEl = document.getElementById('page-info')
const includePageEl = document.getElementById('include-page')
const includeScreenshotEl = document.getElementById('include-screenshot')
const screenshotPreviewEl = document.getElementById('screenshot-preview')
const questionEl = document.getElementById('question')
const askButton = document.getElementById('ask')
const askError = document.getElementById('ask-error')
const chatLogEl = document.getElementById('chat-log')

let pageContext = null
let screenshotDataUrl = null

// textContent would nuke the whole label every render, so build it once as two nodes instead:
// a muted "Signed in as " prefix plus a brighter, theme-accented span just for the username.
const sessionPrefixNode = document.createTextNode('')
const sessionNameAccent = document.createElement('span')
sessionNameAccent.className = 'accent-text'
sessionNameEl.append(sessionPrefixNode, sessionNameAccent)

function clearChatLog() {
 chatLogEl.innerHTML = ''
}

// Login is always required before asking a question, in both Demo and Live mode — Demo mode's
// login just doesn't make a real network call (see auth.js's login()). getSession() is backed by
// chrome.storage.session (see auth.js), which is itself cleared whenever the browser closes, so a
// fresh browser launch always lands back here regardless of what's in this function.
async function render() {
 const session = await getSession()
 const needsLogin = !session
 loginView.hidden = !needsLogin
 mainView.hidden = needsLogin
 liveToggle.setAttribute('aria-pressed', String(isLive()))
 liveToggleLabel.textContent = isLive() ? 'Live' : 'Demo'
 if (session) {
  sessionPrefixNode.textContent = 'Signed in as '
  sessionNameAccent.textContent = session.name
 } else {
  sessionPrefixNode.textContent = 'Not signed in'
  sessionNameAccent.textContent = ''
 }
}

liveToggle.addEventListener('click', async () => {
 // A Demo session token is meaningless to the real backend and vice versa, so switching modes
 // clears whatever session exists and sends the user back through login for the new mode.
 setLive(!isLive())
 await clearSession()
 clearChatLog()
 await render()
})

loginSubmit.addEventListener('click', async () => {
 loginError.textContent = ''
 const username = usernameEl.value.trim()
 const password = passwordEl.value
 if (!username || !password) { loginError.textContent = 'Enter your username and password.'; return }
 loginSubmit.disabled = true
 try {
  await login(username, password)
  passwordEl.value = ''
  await render()
 } catch (e) {
  loginError.textContent = e instanceof Error ? e.message : 'Unable to sign in right now.'
 } finally {
  loginSubmit.disabled = false
 }
})

signOutButton.addEventListener('click', async () => {
 await clearSession()
 clearChatLog()
 await render()
})

// Reads the current tab's title/url/selection/excerpt (content-script.js), injected only when the
// popup opens — not a persistent content script, so it never runs on pages the user hasn't
// actively invoked it on. Feeds pcExtraContext.
async function capturePageContext() {
 const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
 if (!tab?.id) return null
 try {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] })
  return injection?.result ?? null
 } catch {
  // Throws on pages the extension can't be injected into (chrome://, the Web Store, etc.).
  return null
 }
}

async function initPageContext() {
 pageContext = await capturePageContext()
 if (pageContext) {
  pageInfoEl.textContent = `${pageContext.title} — ${pageContext.url}`
 } else {
  pageInfoEl.textContent = "Can't read this page (e.g. a browser-internal or restricted page)."
  includePageEl.checked = false
  includePageEl.disabled = true
  includeScreenshotEl.checked = false
  includeScreenshotEl.disabled = true
 }
 pageInfoEl.hidden = !includePageEl.checked
}

includePageEl.addEventListener('change', () => {
 pageInfoEl.hidden = !includePageEl.checked
})

function formatExtraContext(context) {
 const lines = [`Page title: ${context.title}`, `URL: ${context.url}`]
 if (context.selection) lines.push(`Selected text: ${context.selection}`)
 if (context.excerpt) lines.push(`Page excerpt: ${context.excerpt}`)
 return lines.join('\n')
}

// Captures only the visible viewport (chrome.tabs.captureVisibleTab) — a full scrolling-page
// screenshot would need extra scroll-and-stitch logic this doesn't do yet. Allowed here under the
// activeTab permission since it's invoked as a direct result of opening/using the popup. Returns
// the full "data:image/png;base64,..." URL (displayable directly in an <img>); the prefix is
// stripped separately, only when building the request payload — see askKnowledge's call site.
async function captureScreenshot() {
 try {
  return await chrome.tabs.captureVisibleTab(undefined, { format: 'png' })
 } catch {
  return null
 }
}

// Captures once right when the checkbox is ticked (rather than lazily at ask-time) so what's
// previewed here is exactly what gets sent — popups close as soon as they lose focus, so there's
// no risk of this going stale against a different tab within one popup session.
async function updateScreenshotPreview() {
 if (!includeScreenshotEl.checked) {
  screenshotDataUrl = null
  screenshotPreviewEl.hidden = true
  screenshotPreviewEl.textContent = ''
  return
 }
 screenshotPreviewEl.hidden = false
 screenshotPreviewEl.textContent = 'Capturing…'
 screenshotDataUrl = await captureScreenshot()
 if (screenshotDataUrl) {
  screenshotPreviewEl.textContent = ''
  const img = document.createElement('img')
  img.src = screenshotDataUrl
  img.alt = 'Screenshot of the current page'
  screenshotPreviewEl.append(img)
 } else {
  screenshotPreviewEl.textContent = "Couldn't capture a screenshot of this page."
 }
}

includeScreenshotEl.addEventListener('change', updateScreenshotPreview)

// textContent throughout — question is user-typed, never trust it as markup.
function addUserBubble(text) {
 const bubble = document.createElement('div')
 bubble.className = 'bubble user'
 bubble.textContent = text
 chatLogEl.append(bubble)
 chatLogEl.scrollTop = chatLogEl.scrollHeight
}

function addAssistantBubble() {
 const bubble = document.createElement('div')
 bubble.className = 'bubble assistant'
 const head = document.createElement('div')
 head.className = 'bubble-head'
 const img = document.createElement('img')
 img.src = 'icon48.png'
 img.alt = ''
 head.append(img, document.createTextNode('MiPeers'))
 const body = document.createElement('div')
 body.className = 'bubble-body thinking'
 const label = document.createElement('span')
 label.textContent = 'Thinking'
 const dots = document.createElement('span')
 dots.className = 'dots'
 dots.textContent = '•••'
 body.append(label, dots)
 bubble.append(head, body)
 chatLogEl.append(bubble)
 chatLogEl.scrollTop = chatLogEl.scrollHeight
 return { bubble, body }
}

askButton.addEventListener('click', async () => {
 const question = questionEl.value.trim()
 if (!question) return
 askError.textContent = ''
 askButton.disabled = true
 addUserBubble(question)
 questionEl.value = ''
 const { bubble, body } = addAssistantBubble()
 try {
  const extraContext = includePageEl.checked && pageContext ? formatExtraContext(pageContext) : ''
  const extraContextImages = includeScreenshotEl.checked && screenshotDataUrl
   ? screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '')
   : null
  const answer = await askKnowledge(question, extraContext, extraContextImages)
  body.className = 'bubble-body'
  body.textContent = answer
 } catch (e) {
  bubble.remove()
  askError.textContent = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
 } finally {
  askButton.disabled = false
  chatLogEl.scrollTop = chatLogEl.scrollHeight
 }
})

function applyTheme() {
 document.documentElement.dataset.theme = getTheme()
}

themeToggle.addEventListener('click', () => {
 setTheme(getTheme() === 'light' ? 'dark' : 'light')
 applyTheme()
})

applyTheme()
await render()
initPageContext()
