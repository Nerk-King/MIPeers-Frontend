<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './components/Icon.vue'
import AgentAvatar from './components/AgentAvatar.vue'
import KnowledgeTree from './components/KnowledgeTree.vue'
import UploadData from './components/UploadData.vue'
import RagUpload from './components/RagUpload.vue'
import Login from './Login.vue'
import { agents, type KnowledgeDocument } from './data'
import { libraryDocuments as documents, getKnowledgeTree, downloadKnowledgeDocument } from './services/knowledge'
import { localResources, downloadResource, removeResource } from './services/uploads'
import { askKnowledge, buildChatContext, deleteRagHistory, fetchRagHistory } from './services/rag'
import { summarizeTitle } from './services/title'
import { currentUserName, sessionToken, signOut } from './services/auth'
import { isLive, toggleLive } from './services/liveMode'
type Message = { id: string; role: 'user' | 'assistant'; content: string; sources: { name: string; page: string }[]; liked?: boolean; saved?: boolean }
// datasetObj is only set for live-mode chats loaded from ilDecision:fetchRagHistory. contextSince
// marks where the current pcContext window starts counting from — once that window overflows the
// budget it's cleared and this advances to the latest message, so context cycles through
// fill-then-empty rather than permanently going silent for the rest of a long conversation.
type Conversation = { id: string; datasetObj?: number; title: string; date: string; agentId: string; messages: Message[]; contextSince?: number }
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
function capitalize(value: string): string { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value }
// Conversations persisted before "sources" replaced "sourceIds" won't have that field — default it
// so legacy localStorage data can't crash rendering.
function normalizeConversations(raw: Conversation[]): Conversation[] {
 return raw.map(c => ({ ...c, messages: c.messages.map(m => ({ ...m, sources: Array.isArray(m.sources) ? m.sources : [] })) }))
}
const route = useRoute(), router = useRouter()
const nav = [{ path: '/home', name: 'Home', icon: 'Home' }, { path: '/chat', name: 'Chat', icon: 'LayoutDashboard' }, { path: '/agents', name: 'AI Agents', icon: 'Bot' }, { path: '/library', name: 'Knowledge Library', icon: 'Folder' }, { path: '/history', name: 'History', icon: 'Clock3' }, { path: '/bookmarks', name: 'Bookmarks', icon: 'Bookmark' }]
// Demo mode keeps chats in localStorage; live mode loads them from ilDecision:fetchRagHistory (see loadHistory).
const conversations = ref<Conversation[]>(isLive.value ? [] : normalizeConversations(read('mipeers-conversations', [])))
// Likes/bookmarks aren't part of the server history, so in live mode they're kept locally, keyed by message id.
type MessageFlags = Record<string, { liked?: boolean; saved?: boolean }>
let remoteHistoryLoaded = false
type Preferences = { name: string; showSources: boolean; compact: boolean; theme: 'dark' | 'light'; uploadsPath: string }
const defaults: Preferences = { name: 'Admin', showSources: true, compact: false, theme: 'dark', uploadsPath: '' }
const preferences = ref<Preferences>({ ...defaults, ...read<Partial<Preferences>>('mipeers-preferences', {}) })
watch(() => preferences.value.theme, theme => {
 document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
}, { immediate: true })
watch(currentUserName, name => { if (name) preferences.value.name = capitalize(name) }, { immediate: true })
const currentId = ref(conversations.value[0]?.id || ''), agentId = ref('general'), question = ref(''), search = ref(''), pending = ref(false), error = ref(''), toast = ref(''), mobileNav = ref(false), agentMenu = ref(false), notifications = ref(false)
const drawer = ref(false), selectedDoc = ref<KnowledgeDocument | null>(null), agentDetails = ref(false), messagesEl = ref<HTMLElement | null>(null)
const uploadOpen = ref(false), uploadBusy = ref(false), removePending = ref(false), ragUploadOpen = ref(false)
const selectedLocal = computed(() => localResources.value.find(resource => resource.id === selectedDoc.value?.id))
let controller: AbortController | undefined, toastTimer: ReturnType<typeof setTimeout>
const page = computed(() => nav.find(n => n.path === route.path)?.name || 'Settings')
const current = computed(() => conversations.value.find(c => c.id === currentId.value))
const agent = computed(() => agents.find(a => a.id === agentId.value) || agents[0])
const lastAnswer = computed(() => [...(current.value?.messages || [])].reverse().find(m => m.role === 'assistant'))
// One flag for every service (login, chat, uploads, knowledge library) — toggled from the topbar pill.
const demoMode = computed(() => !isLive.value)
const contextUsage = computed(() => buildChatContext((current.value?.messages || []).slice(current.value?.contextSince ?? 0).map(m => ({ role: m.role, content: m.content }))))
const results = computed(() => documents.value.filter(d => `${d.name} ${d.category}`.toLowerCase().includes(search.value.toLowerCase())))
const saved = computed(() => conversations.value.flatMap(c => c.messages.filter(m => m.saved).map(m => ({ ...m, conversation: c }))))
const historyResults = computed(() => conversations.value.filter(c => c.title.toLowerCase().includes(search.value.toLowerCase())))
const suggestions = [{ icon: 'MessageCircle', color: 'purple', label: 'Explore our product', text: 'What are the key features of our product?' }, { icon: 'Code2', color: 'green', label: 'Build an integration', text: 'How do I integrate the API with OAuth?' }, { icon: 'Clock3', color: 'orange', label: 'Understand settlement', text: 'What are the current settlement rules?' }, { icon: 'Shield', color: 'blue', label: 'Find a policy', text: 'What are our data retention policies?' }]
watch(conversations, value => {
 try {
  if (!isLive.value) { localStorage.setItem('mipeers-conversations', JSON.stringify(value)); return }
  // Until the history has loaded, an empty list would look like every flag was cleared.
  if (!remoteHistoryLoaded) return
  const flags = read<MessageFlags>('mipeers-message-flags', {})
  for (const m of value.flatMap(c => c.messages)) {
   if (m.liked || m.saved) flags[m.id] = { liked: m.liked, saved: m.saved }
   else delete flags[m.id]
  }
  localStorage.setItem('mipeers-message-flags', JSON.stringify(flags))
 } catch { notify('Browser storage is full. Changes will last for this session.') }
}, { deep: true })
let historyRequest = 0
async function loadHistory() {
 const request = ++historyRequest
 remoteHistoryLoaded = false
 if (!isLive.value) { conversations.value = normalizeConversations(read('mipeers-conversations', [])); return }
 conversations.value = []
 if (!sessionToken.value) return
 try {
  const history = await fetchRagHistory()
  if (request !== historyRequest) return
  const flags = read<MessageFlags>('mipeers-message-flags', {})
  conversations.value = history.map(c => ({ ...c, agentId: 'general', messages: c.messages.map(m => ({ ...m, ...flags[m.id] })) }))
  remoteHistoryLoaded = true
  if (!current.value) currentId.value = ''
 } catch (e) {
  if (request === historyRequest) notify(e instanceof Error ? e.message : 'Unable to load chat history.')
 }
}
watch([isLive, sessionToken], loadHistory)
const deletingId = ref('')
async function deleteConversation(c: Conversation) {
 if (isLive.value) {
  deletingId.value = c.id
  try {
   // A chat started this session has no DatasetObj yet — look it up by title (what ragAsk saved it under).
   const datasetObj = c.datasetObj ?? (await fetchRagHistory()).find(h => h.title === c.title)?.datasetObj
   if (datasetObj === undefined) throw new Error('This conversation has not been saved yet, so it cannot be deleted.')
   await deleteRagHistory(datasetObj)
  } catch (e) {
   notify(e instanceof Error ? e.message : 'Unable to delete this conversation.')
   return
  } finally {
   deletingId.value = ''
  }
 }
 conversations.value = conversations.value.filter(item => item.id !== c.id)
 if (currentId.value === c.id) currentId.value = ''
 notify('Conversation deleted')
}
watch(preferences, value => { try { localStorage.setItem('mipeers-preferences', JSON.stringify(value)) } catch { notify('Unable to save preferences on this device.') } }, { deep: true })
// Home is always a fresh start — never resume whatever conversation was last open.
watch(() => route.path, path => { search.value = ''; mobileNav.value = false; notifications.value = false; if (path === '/home') { controller?.abort(); currentId.value = '' } })
watch(() => current.value?.messages.length, async () => { await nextTick(); messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' }) })
function notify(text: string) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 3200) }
onMounted(() => { getKnowledgeTree().catch(() => notify('Unable to load the library. Open Knowledge Library to try again.')); loadHistory() })
function closeUpload() { if (!uploadBusy.value) uploadOpen.value = false }
const downloadPending = ref(false)
async function downloadRemote(doc: KnowledgeDocument) {
 downloadPending.value = true
 try { await downloadKnowledgeDocument(doc) } catch (e) { notify(e instanceof Error ? e.message : 'Download failed.') } finally { downloadPending.value = false }
}
function downloadSelected() { try { if (selectedLocal.value) downloadResource(selectedLocal.value.id) } catch (e) { notify(e instanceof Error ? e.message : 'Download failed.') } }
async function deleteSelected() {
 if (!selectedLocal.value || removePending.value) return
 removePending.value = true
 try { await removeResource(selectedLocal.value.id); selectedDoc.value = null; notify('Local resource removed.') }
 catch (e) { notify(e instanceof Error ? e.message : 'Could not remove this resource.') }
 finally { removePending.value = false }
}
// Abort (rather than refuse) so a hung/slow request never leaves the user stuck with no way out.
function newChat() { controller?.abort(); currentId.value = ''; question.value = ''; error.value = ''; router.push('/chat') }
function openConversation(c: Conversation) { controller?.abort(); currentId.value = c.id; agentId.value = c.agentId; router.push('/chat') }
async function send(text = question.value) {
 if (!text.trim() || pending.value) return
 const content = text.trim(); question.value = ''; error.value = ''; pending.value = true
 if (!current.value) { const c: Conversation = { id: crypto.randomUUID(), title: summarizeTitle(content), date: new Date().toISOString(), agentId: agentId.value, messages: [] }; conversations.value.unshift(c); currentId.value = c.id }
 const c = current.value!; c.messages.push({ id: crypto.randomUUID(), role: 'user', content, sources: [] }); router.push('/chat'); controller = new AbortController()
 const history = c.messages.slice(c.contextSince ?? 0, -1).map(m => ({ role: m.role, content: m.content }))
 const ctx = buildChatContext(history)
 if (ctx.truncated) c.contextSince = c.messages.length - 1 // window overflowed — start counting fresh from this message
 try { const response = await askKnowledge({ question: content, agentId: agentId.value, title: c.title, context: ctx.context }, controller.signal); c.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: response.answer, sources: response.sources }) }
 catch (e) {
  // A user-initiated cancel (New conversation / switching chats while pending) aborts the
  // request on purpose — nothing went wrong, so don't surface an error or restore the question.
  if (!(e instanceof DOMException && e.name === 'AbortError')) { error.value = e instanceof Error ? e.message : 'Something went wrong. Please try again.'; question.value = content }
 }
 finally { pending.value = false }
}
async function copy(text: string) { try { await navigator.clipboard.writeText(text); notify('Answer copied to clipboard') } catch { notify('Clipboard is unavailable in this browser.') } }
function openSource(source: { name: string; page: string }) {
 const doc = documents.value.find(d => d.name === source.name)
 if (doc) selectedDoc.value = doc
 else notify('No local preview available for this source.')
}
function chooseAgent(id: string) { agentId.value = id; if (current.value) current.value.agentId = id; agentMenu.value = false }
function logOut() { signOut(); router.push('/login') }
function escape(e: KeyboardEvent) { if (e.key === 'Escape') { closeUpload(); drawer.value = false; selectedDoc.value = null; agentDetails.value = false; agentMenu.value = false; notifications.value = false; mobileNav.value = false; ragUploadOpen.value = false } }
window.addEventListener('keydown', escape)
const modalOpen = computed(() => drawer.value || !!selectedDoc.value || agentDetails.value || uploadOpen.value || ragUploadOpen.value)
let previousFocus: HTMLElement | null = null
watch(modalOpen, async (open) => {
 if (open) previousFocus = document.activeElement as HTMLElement
 await nextTick()
 document.querySelectorAll<HTMLElement>('.sidebar, .main-shell').forEach(el => { el.inert = open })
 document.body.style.overflow = open ? 'hidden' : ''
 if (open) document.querySelector<HTMLElement>('.drawer .icon-button')?.focus()
 else previousFocus?.focus()
})
function trapFocus(e: KeyboardEvent) {
 if (!modalOpen.value || e.key !== 'Tab') return
 const items = Array.from(document.querySelectorAll<HTMLElement>('.drawer button, .drawer input, .drawer textarea, .drawer select, .drawer a[href]')).filter(el => !el.matches(':disabled') && el.getClientRects().length > 0 && el.tabIndex >= 0)
 const first = items[0], last = items[items.length - 1]
 if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
 else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
}
window.addEventListener('keydown', trapFocus)
const toolLife = new AbortController()
const modelContext = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext
if (modelContext?.registerTool) {
 try { Promise.resolve(modelContext.registerTool({ name: 'ask_knowledge', description: 'Send a question in the visible knowledge workspace and wait for the answer. Creates a conversation if necessary.', inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, async execute(input: unknown) { if (!input || typeof input !== 'object' || !('question' in input) || typeof input.question !== 'string' || !input.question.trim()) throw new Error('A non-empty question is required.'); if (pending.value) throw new Error('Wait for the current response.'); await send(input.question); await nextTick(); if (error.value) throw new Error(error.value); return { conversationId: currentId.value, answer: lastAnswer.value?.content }; } }, { signal: toolLife.signal })).catch(() => {}) } catch { /* Browser capability is optional. */ }
}
onBeforeUnmount(() => { toolLife.abort(); window.removeEventListener('keydown', trapFocus) })
onBeforeUnmount(() => { window.removeEventListener('keydown', escape); controller?.abort(); clearTimeout(toastTimer) })
</script>

<template>
 <Login v-if="route.path === '/' || route.path === '/login'" />
 <div v-else :class="['app-shell', { compact: preferences.compact }]">
  <div v-if="mobileNav" class="mobile-backdrop" @click="mobileNav = false"></div>
  <aside :class="['sidebar', { 'mobile-open': mobileNav }]">
   <RouterLink to="/home" class="brand" aria-label="MiPeers home"><span class="brand-word">MiP<span class="brand-dot">.</span></span><span class="brand-caption">HUMAN SOFTWARE COMPANY</span></RouterLink>
   <div class="workspace-label">WORKSPACE</div>
   <nav><RouterLink v-for="item in nav" :key="item.path" :to="item.path" :class="['nav-link', { active: route.path === item.path }]"><Icon :name="item.icon"/><span>{{ item.name }}</span><span v-if="item.path === '/bookmarks' && saved.length" class="nav-count">{{ saved.length }}</span></RouterLink></nav>
   <div class="sidebar-bottom"><div class="workspace-status"><span class="status-dot"></span><div>Knowledge workspace<small>{{ demoMode ? 'Demo environment' : 'Connected environment' }}</small></div></div><RouterLink to="/settings" :class="['nav-link', {active: route.path === '/settings'}]"><Icon name="Settings"/><span>Settings</span></RouterLink><button class="profile" @click="router.push('/settings')"><span class="avatar">{{ preferences.name.charAt(0) || 'A' }}</span><span>{{ preferences.name }}<small>Workspace admin</small></span><Icon name="ChevronDown" :size="16"/></button></div>
  </aside>
  <main class="main-shell">
   <header class="topbar"><div class="page-label"><button class="icon-button mobile-toggle" aria-label="Toggle navigation" @click="mobileNav = !mobileNav"><Icon name="Menu"/></button><span class="breadcrumb">Workspace <Icon name="ChevronRight" :size="14"/></span><span>{{ page }}</span></div><div class="header-tools"><div class="global-search"><Icon name="Search" :size="17"/><input v-model="search" aria-label="Search knowledge base" placeholder="Search knowledge base…" @keydown.enter="router.push('/library')"><kbd>↵</kbd><div v-if="search && !['/history','/library'].includes(route.path)" class="search-popover"><button v-for="doc in results" :key="doc.id" @click="selectedDoc = doc; search = ''"><Icon name="FileText" :size="16"/>{{ doc.name }}</button><p v-if="!results.length">No documents found.</p></div></div><button :class="['live-toggle', { live: isLive }]" :aria-pressed="isLive" @click="toggleLive(); notify(isLive ? 'Live mode — real calls go to the knowledge service.' : 'Demo mode — sample data only, no real calls.')"><span class="live-toggle-dot"/>{{ isLive ? 'Live' : 'Demo' }}</button><div class="notification-wrap"><button class="icon-button notification-button" aria-label="Notifications" @click="notifications = !notifications"><Icon name="Bell"/><i/></button><div v-if="notifications" class="notification-popover"><strong>You're all caught up</strong><p>Your workspace is ready to explore.</p></div></div><button class="avatar small" aria-label="Open profile settings" @click="router.push('/settings')">{{ preferences.name.charAt(0) || 'A' }}</button></div></header>

   <section v-if="route.path === '/home'" class="home-page">
    <div class="home-topline"><span class="eyebrow"><span class="status-dot"/> YOUR KNOWLEDGE, CONNECTED</span><span class="subtle">MiPeers workspace</span></div>
    <div class="home-grid"><div class="welcome-area"><div class="welcome"><Icon name="Sparkles"/><span>Welcome back, <strong>{{ preferences.name }}</strong></span></div><div class="home-asker"><span :class="['asker-avatar', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="64" animated/></span><span class="asker-copy"><strong>{{ agent.name }}</strong><small>is waiting for your question…</small></span></div><h1>How can I help<br>you today<span class="purple-text">?</span></h1><p class="home-description">A little curiosity. A world of knowledge.<br>Find answers in your team's collective expertise.</p><form class="home-composer" @submit.prevent="send()"><div class="home-input-row"><Icon name="Search" :size="23"/><input v-model="question" aria-label="Ask your knowledge base" placeholder="Ask anything or search your knowledge base…"><button class="send-button" :disabled="!question.trim() || pending" aria-label="Send question"><Icon name="ArrowUp" :size="24"/></button></div><div class="composer-foot"><span><Icon name="Sparkles" :size="14"/> {{ agent.short }}</span><span>Enter to ask <span class="enter-key">↵</span></span></div></form><div class="try-heading"><span>Not sure where to start?</span><span class="subtle">Try asking</span></div><div class="suggestions"><button v-for="s in suggestions" :key="s.label" @click="send(s.text)"><span :class="['suggestion-icon', s.color]"><Icon :name="s.icon"/></span><span class="suggestion-label">{{ s.label }}</span><span class="suggestion-question">{{ s.text }}</span><Icon name="ArrowUpRight" class="suggestion-arrow" :size="17"/></button></div></div>
    <aside class="home-rail"><div class="rail-orbit"><Icon name="Sparkles" :size="29"/></div><span class="eyebrow">BUILT AROUND YOUR KNOWLEDGE</span><h2>The right answer.<br>The right source.</h2><p>Bring your questions.<br>We'll help you find a starting point.</p><button class="rail-link" @click="router.push('/agents')"><span class="rail-icon purple"><Icon name="Bot" :size="24"/></span><span>AI Agents<small>A specialist for every question</small></span><Icon name="ChevronRight" :size="17"/></button><button class="rail-link" @click="drawer = true"><span class="rail-icon blue"><Icon name="Folder" :size="24"/></span><span>Knowledge Library<small>Explore your source of truth</small></span><Icon name="ChevronRight" :size="17"/></button><div class="rail-footer"><span class="status-dot"/>{{ documents.length }} documents available</div></aside></div><footer class="home-footer"><span><Icon name="Shield" :size="14"/> Your team's knowledge. In one place.</span><span>Powered by <strong>Progress Agentic RAG</strong></span></footer>
   </section>

   <section v-else-if="route.path === '/chat'" class="chat-layout">
    <div class="chat-main"><div class="chat-toolbar"><div class="agent-picker"><button class="agent-select" :disabled="pending" @click="agentMenu = !agentMenu"><span :class="['agent-orb', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="20"/></span><span>{{ agent.name }}</span><span v-if="agent.id === 'general'" class="badge">Default</span><Icon name="ChevronDown" :size="16"/></button><div v-if="agentMenu" class="agent-options"><button v-for="a in agents" :key="a.id" @click="chooseAgent(a.id)"><span :class="['agent-orb', 'mini', a.color]"><AgentAvatar :color="a.color" :icon="a.icon" :size="16"/></span>{{ a.name }}<Icon v-if="agentId === a.id" name="Check" :size="16"/></button></div></div><button class="icon-button" title="New conversation" aria-label="New conversation" :disabled="pending" @click="newChat"><Icon name="Plus"/></button><button class="icon-button sources-toggle" aria-label="Toggle sources" @click="preferences.showSources = !preferences.showSources"><Icon name="PanelRightClose"/></button></div>
    <div class="messages" ref="messagesEl"><div v-if="!current?.messages.length" class="chat-empty"><span :class="['large-orb', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="38"/></span><h2>Let's find your answer.</h2><p>Ask {{ agent.short.toLowerCase() }} a question to get started.</p><button class="outline-button" @click="send('What are the current settlement rules?')">What are the current settlement rules? <Icon name="ArrowUpRight" :size="17"/></button></div><template v-for="message in current?.messages" :key="message.id"><div :class="['message', message.role]"><span v-if="message.role === 'assistant'" :class="['agent-orb', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="20"/></span><div class="message-body"><div v-if="message.role === 'assistant'" class="answer-heading">{{ agent.name }}<span v-if="demoMode" class="subtle">Sample answer</span></div><div class="message-text">{{ message.content }}</div><div v-if="message.role === 'assistant'" class="message-actions"><button aria-label="Copy answer" title="Copy answer" @click="copy(message.content)"><Icon name="Copy" :size="16"/></button><button :aria-pressed="!!message.liked" aria-label="Mark helpful" :class="{ selected: message.liked }" @click="message.liked = !message.liked"><Icon name="ThumbsUp" :size="16"/></button><button :aria-pressed="!!message.saved" :class="{ selected: message.saved }" aria-label="Bookmark answer" @click="message.saved = !message.saved; notify(message.saved ? 'Answer bookmarked' : 'Bookmark removed')"><Icon :name="message.saved ? 'Check' : 'Bookmark'" :size="16"/></button></div><div v-if="message.sources.length" class="answer-sources"><h4><Icon name="BookOpen" :size="16"/> Sources <span>{{ message.sources.length }}</span></h4><button v-for="(source, index) in message.sources" :key="index" @click="openSource(source)"><span class="source-number">{{ index + 1 }}</span><span>{{ source.name }}</span><small>Page {{ source.page }}</small><Icon name="ArrowUpRight" :size="14"/></button></div></div></div></template><div v-if="pending" class="thinking" role="status"><Icon name="Sparkles"/> Searching your knowledge<span>•••</span></div><div v-if="error" class="error" role="alert">{{ error }} Your question is below so you can retry.</div></div>
    <div class="chat-bottom"><form class="chat-composer" @submit.prevent="send()"><textarea v-model="question" aria-label="Message" :placeholder="current?.messages.length ? 'Ask a follow-up question…' : 'Ask your knowledge base…'" @keydown.enter.exact.prevent="send()"/><div class="composer-foot"><div class="composer-foot-left"><button type="button" class="text-button" @click="drawer = true"><Icon name="Folder" :size="17"/> Knowledge library</button><span v-if="current?.messages.length" class="context-meter" :class="{ warn: contextUsage.percent >= 80 }"><span class="context-meter-track" :title="`${contextUsage.usedChars} / ${contextUsage.limitChars} characters of conversation context`"><span class="context-meter-fill" :style="{ width: contextUsage.percent + '%' }"/></span>Context {{ contextUsage.percent }}%<Icon name="AlertTriangle" :size="13" class="context-meter-warning" title="At 100%, conversation context is cleared and starts building up again from scratch. Nothing is deleted from the chat itself — the AI just stops remembering earlier turns until context rebuilds."/></span></div><div><span><Icon name="Sparkles" :size="14"/> Powered by RAG</span><button class="send-button" :disabled="!question.trim() || pending" aria-label="Send message"><Icon name="ArrowUp" :size="22"/></button></div></div></form><p class="composer-note">{{ demoMode ? 'Demo responses and sample documents. Connect your knowledge service for grounded answers.' : 'AI can make mistakes. Review the original sources for important decisions.' }}</p></div></div>
    <aside v-if="preferences.showSources" class="chat-rail"><section class="panel"><div class="panel-heading"><h3>AI Agent</h3><button @click="agentDetails = true">View details</button></div><div class="agent-summary"><span :class="['large-orb', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="30"/></span><div><strong>{{ agent.name }}</strong><p>{{ agent.description }}</p></div></div></section><section class="panel source-panel"><div class="panel-heading"><h3>Knowledge Sources</h3><button @click="drawer = true">View library</button></div><KnowledgeTree :active="lastAnswer?.sources.map(s => s.name)" @open="selectedDoc = $event"/><p class="sources-note"><Icon name="Sparkles" :size="17"/> Highlighted documents are referenced in the latest answer.</p></section></aside>
   </section>

   <section v-else class="content-page"><div class="content-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h1>{{ page }}</h1><p>{{ route.path === '/agents' ? 'The right expertise for your next question.' : route.path === '/library' ? 'Explore the knowledge behind every answer.' : route.path === '/history' ? 'Pick up where you left off.' : route.path === '/bookmarks' ? 'Useful answers, right where you need them.' : 'Make this workspace yours.' }}</p></div><div v-if="route.path === '/library'" class="content-heading-actions"><button class="primary-button" @click="ragUploadOpen = true"><Icon name="ArrowUp" :size="18"/>Send to knowledge base</button><button class="outline-button" @click="uploadOpen = true"><Icon name="Plus" :size="18"/>Save to local</button></div><button v-if="route.path === '/history'" class="primary-button" :disabled="pending" @click="newChat"><Icon name="Plus" :size="18"/>New conversation</button></div>
    <div v-if="route.path === '/agents'" class="agent-cards"><article v-for="a in agents" :key="a.id" class="agent-card"><span class="pet-portrait"><AgentAvatar :color="a.color" :icon="a.icon" :size="112"/></span><span class="badge" v-if="a.id === 'general'">Default agent</span><h2>{{ a.name }}</h2><p>{{ a.description }}</p><div class="tags"><span v-for="tag in a.tags" :key="tag">{{ tag }}</span></div><button class="outline-button" :disabled="pending" @click="chooseAgent(a.id); newChat()">Start conversation<Icon name="ArrowUpRight" :size="18"/></button></article></div>
    <template v-if="route.path === '/library'"><div class="library-toolbar"><span><strong>{{ documents.length }}</strong> documents <span class="subtle">· {{ demoMode ? 'Sample library + local uploads' : 'Connected library + local uploads' }}</span></span><div class="filter-search"><Icon name="Search" :size="17"/><input v-model="search" aria-label="Filter documents" placeholder="Find a document…"/></div></div><div v-if="search" class="document-list"><button v-for="doc in results" :key="doc.id" @click="selectedDoc = doc"><span class="document-icon"><Icon name="FileText"/></span><span><strong>{{ doc.name }}</strong><small>{{ doc.category }} / {{ doc.folder }}</small></span><span class="document-date">{{ doc.date }}</span><Icon name="ArrowUpRight" :size="18"/></button><div v-if="!results.length" class="empty-state"><Icon name="Search" :size="30"/><h2>No matching documents</h2><p>Try a different name or category.</p></div></div><div v-else class="library-tree-panel"><KnowledgeTree :active="lastAnswer?.sources.map(s => s.name)" @open="selectedDoc = $event"/></div></template>
    <template v-if="route.path === '/history'"><div class="filter-search history-search"><Icon name="Search" :size="17"/><input v-model="search" aria-label="Search conversations" placeholder="Search conversations…"/></div><div class="history-list"><article v-for="c in historyResults" :key="c.id"><button class="history-open" :disabled="pending" @click="openConversation(c)"><span class="document-icon"><Icon name="MessageCircle"/></span><span><strong>{{ c.title }}</strong><small>{{ new Date(c.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) }} · {{ c.messages.length }} messages</small></span><Icon name="ChevronRight" :size="18"/></button><button class="icon-button" :disabled="pending || deletingId === c.id" aria-label="Delete conversation" @click="deleteConversation(c)"><Icon name="Trash2" :size="17"/></button></article></div><div v-if="!historyResults.length" class="empty-state"><Icon name="Clock3" :size="34"/><h2>{{ search ? 'No matching conversations' : 'A fresh start' }}</h2><p>Your conversations will appear here after you ask a question.</p><button class="primary-button" @click="newChat">Ask your first question<Icon name="ArrowUpRight" :size="18"/></button></div></template>
    <template v-if="route.path === '/bookmarks'"><div class="bookmark-grid"><article v-for="m in saved" :key="m.id" class="bookmark-card"><div><span class="eyebrow">SAVED ANSWER</span><button class="icon-button" aria-label="Remove bookmark" @click="m.conversation.messages.find(item => item.id === m.id)!.saved = false"><Icon name="Bookmark" :size="18"/></button></div><h2>{{ m.conversation.title }}</h2><p>{{ m.content.slice(0, 230) }}…</p><button class="text-button" :disabled="pending" @click="openConversation(m.conversation)">Open conversation<Icon name="ArrowUpRight" :size="17"/></button></article></div><div v-if="!saved.length" class="empty-state"><Icon name="Bookmark" :size="34"/><h2>Keep the answers that matter</h2><p>Use the bookmark icon under an answer to save it here.</p><button class="outline-button" @click="router.push('/chat')">Go to dashboard<Icon name="ArrowUpRight" :size="17"/></button></div></template>
    <div v-if="route.path === '/settings'" class="settings-panel"><h3>Profile</h3><label class="setting-row"><span>Display name<small>How you appear in this workspace</small></span><input v-model="preferences.name" maxlength="32" placeholder="Admin" aria-label="Display name"/></label><div class="setting-row"><span>Session<small>Signed in to this workspace</small></span><button class="outline-button" @click="logOut">Sign out</button></div><h3>Appearance</h3><label class="setting-row"><span>Light mode<small>Use a bright theme for your workspace</small></span><input type="checkbox" role="switch" aria-label="Light mode" v-model="preferences.theme" true-value="light" false-value="dark"/></label><h3>Workspace preferences</h3><label class="setting-row"><span>Knowledge sources<small>Show the source panel beside your conversation</small></span><input type="checkbox" role="switch" v-model="preferences.showSources"/></label><label class="setting-row"><span>Compact navigation<small>Give your content a little more room</small></span><input type="checkbox" role="switch" v-model="preferences.compact"/></label><h3>Knowledge uploads</h3><label class="setting-row"><span>Local uploads folder<small>Files are saved here before being sent to the knowledge base</small></span><input v-model="preferences.uploadsPath" placeholder="I:\path\to\uploads" aria-label="Local uploads folder path"/></label><h3>About this workspace</h3><div class="setting-row"><span>Knowledge service<small>{{ demoMode ? 'Sample answers and documents are enabled' : 'Using your configured knowledge endpoint' }}</small></span><span class="badge">{{ demoMode ? 'Demo mode' : 'Configured' }}</span></div><div class="setting-row"><span>Upload service<small>{{ demoMode ? 'Uploads are simulated, nothing is sent' : 'Using your configured upload endpoint' }}</small></span><span class="badge">{{ demoMode ? 'Demo mode' : 'Configured' }}</span></div><p class="settings-note">Preferences and conversation history are saved in this browser.</p></div>
   </section>
  </main>
  <div v-if="uploadOpen" class="overlay" @click.self="closeUpload">
   <section class="drawer upload-drawer" role="dialog" aria-modal="true" aria-labelledby="upload-panel-title" :aria-busy="uploadBusy">
    <div class="drawer-heading"><div><span class="eyebrow">GROW YOUR KNOWLEDGE</span><h2 id="upload-panel-title">Upload data</h2></div><button class="icon-button" :disabled="uploadBusy" aria-label="Close upload panel" @click="closeUpload"><Icon name="X"/></button></div>
    <UploadData @busy="uploadBusy = $event" @saved="notify($event + ($event === 1 ? ' resource added to your local library.' : ' resources added to your local library.'))"/>
   </section>
  </div>
  <RagUpload v-if="ragUploadOpen" :uploads-path="preferences.uploadsPath" @close="ragUploadOpen = false" @open-settings="ragUploadOpen = false; router.push('/settings')" @uploaded="count => notify(count + (count === 1 ? ' file sent to the knowledge base.' : ' files sent to the knowledge base.'))"/>
  <div v-if="drawer || selectedDoc || agentDetails" class="overlay" @click.self="drawer = false; selectedDoc = null; agentDetails = false"><section role="dialog" aria-modal="true" :aria-label="selectedDoc ? selectedDoc.name : agentDetails ? 'Agent details' : 'Knowledge library'" :class="['drawer', { 'document-drawer': selectedDoc }]"><div class="drawer-heading"><div><span class="eyebrow">{{ selectedDoc ? 'DOCUMENT PREVIEW' : agentDetails ? 'YOUR AI SPECIALIST' : 'EXPLORE YOUR KNOWLEDGE' }}</span><h2>{{ selectedDoc ? selectedDoc.name : agentDetails ? 'AI Agent' : 'Knowledge Library' }}</h2></div><button class="icon-button" autofocus aria-label="Close panel" @click="selectedDoc ? selectedDoc = null : agentDetails ? agentDetails = false : drawer = false"><Icon name="X"/></button></div><template v-if="selectedDoc"><span class="demo-document-label">{{ selectedLocal ? 'Local resource · Saved in this browser' : demoMode ? 'Sample document · Preview only' : 'Knowledge document' }}</span><p class="subtle">{{ selectedDoc.category }} / {{ selectedDoc.folder }}</p><article class="document-preview"><Icon name="FileText" :size="32"/><h2>{{ selectedDoc.name }}</h2><p>{{ selectedDoc.content }}</p></article><div v-if="selectedLocal" class="local-resource-actions"><p class="subtle">Saved locally. This resource is not indexed for AI answers.</p><div><button class="outline-button" @click="downloadSelected">Download{{ selectedLocal.file ? ' original' : ' resource' }}</button><a v-if="selectedLocal.url" class="outline-button" :href="selectedLocal.url" target="_blank" rel="noopener noreferrer">Open link<Icon name="ArrowUpRight" :size="16"/></a><button class="outline-button" :disabled="removePending" @click="deleteSelected"><Icon name="Trash2" :size="16"/>{{ removePending ? 'Removing…' : 'Remove resource' }}</button></div></div><div v-else class="document-actions"><button v-if="selectedDoc.downloadLink" class="outline-button" :disabled="downloadPending" @click="downloadRemote(selectedDoc)"><Icon name="ArrowUpRight" :size="16"/>{{ downloadPending ? 'Downloading…' : 'Download file' }}</button><button class="primary-button" :disabled="pending" @click="send('Tell me about ' + selectedDoc.name); selectedDoc = null; drawer = false">Ask about this document<Icon name="ArrowUpRight" :size="17"/></button></div></template><template v-else-if="agentDetails"><span :class="['large-orb', agent.color]"><AgentAvatar :color="agent.color" :icon="agent.icon" :size="30"/></span><h2>{{ agent.name }}</h2><p>{{ agent.description }}</p><h3>Knowledge scope</h3><div class="tags"><span v-for="tag in agent.tags" :key="tag">{{ tag }}</span></div><p class="subtle">Answers include source references so you can review the supporting documents.</p></template><template v-else><p class="subtle">{{ documents.length }} documents across your knowledge folders</p><KnowledgeTree :active="lastAnswer?.sources.map(s => s.name)" @open="selectedDoc = $event"/></template></section></div>
  <div v-if="toast" class="toast" role="status"><Icon name="Check" :size="18"/>{{ toast }}</div>
 </div>
</template>
