<script setup lang="ts">
// Proof-of-concept: floats the agent in a Document Picture-in-Picture window, which stays on top of
// other windows/apps even when this tab is backgrounded or the browser is minimized. Chrome/Edge
// 116+ only (no Firefox/Safari support), and requires a secure context — "localhost" works, a raw
// IP like 127.0.0.1 does not (same restriction crypto.randomUUID has).
//
// The moved content keeps responding to the same reactive state as the main page — moving a DOM
// node into the PiP window's document doesn't recreate it or detach its Vue bindings, so the
// thinking/answer bubble and the input below update live, and submitting from it calls the exact
// same send() the main chat composer uses.
//
// "Transparent background": a real desktop-see-through window isn't possible from web content (no
// OS-level alpha compositing for a page's own window), so this fills the PiP window edge-to-edge
// with a blurred, semi-transparent panel instead — reads as a floating card rather than an app
// window, which is the closest approximation available.
import { ref } from 'vue'
import AgentAvatar from './AgentAvatar.vue'
import Icon from './Icon.vue'

const props = defineProps<{ color: string; icon: string; name: string; pending: boolean; lastAnswer: string }>()
const emit = defineEmits<{ unsupported: []; send: [question: string] }>()

const supported = typeof window !== 'undefined' && !!window.documentPictureInPicture
const floating = ref(false)
const homeRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const question = ref('')
let pipWindow: Window | null = null

function submit() {
 const text = question.value.trim()
 if (!text) return
 emit('send', text)
 question.value = ''
}

async function openOverlay() {
 // Document PiP's resizeTo() requires a direct user gesture for every call — it throws
 // NotAllowedError from an async callback (ResizeObserver, rAF, etc.) once the click that opened
 // it is no longer "active", so the window can't be live-resized while it stays open. Instead,
 // size it correctly up front: measure the content (still in its hidden home here, off-screen but
 // laid out, not display:none) for whatever it currently shows — idle, thinking, or the last
 // answer — and pass that straight to requestWindow(), which isn't subject to the same restriction
 // since it's part of creating the window, directly tied to this click.
 const rect = contentRef.value!.getBoundingClientRect()
 const win = await window.documentPictureInPicture!.requestWindow({ width: Math.ceil(rect.width), height: Math.ceil(rect.height) })
 pipWindow = win

 // Copy the app's stylesheets into the PiP window's separate document so the avatar's scoped
 // styles/animations (and this component's own scoped styles) render the same as on the main page.
 for (const sheet of Array.from(document.styleSheets)) {
  try {
   const css = Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')
   const style = win.document.createElement('style')
   style.textContent = css
   win.document.head.append(style)
  } catch {
   if (sheet.href) {
    const link = win.document.createElement('link')
    link.rel = 'stylesheet'
    link.href = sheet.href
    win.document.head.append(link)
   }
  }
 }

 win.document.title = `${props.name} — MiPeers`
 win.document.documentElement.style.cssText = 'margin:0;padding:0;overflow:hidden;background:transparent;'
 win.document.body.style.cssText = 'margin:0;height:100vh;overflow:hidden;background:transparent;'
 win.document.body.append(contentRef.value!)
 floating.value = true

 // One best-effort correction for window chrome (outerWidth/Height vs innerWidth/Height) — still
 // derived from this same click, so it's usually allowed, but wrapped in try/catch since it isn't
 // guaranteed. Nothing after this point can resize the window; if the content grows later (e.g. a
 // new answer comes in while already open), the bubble scrolls within the existing window instead
 // (see .agent-pip-bubble's max-height) rather than the window changing size or an error being thrown.
 requestAnimationFrame(() => {
  const chromeWidth = win.outerWidth - win.innerWidth
  const chromeHeight = win.outerHeight - win.innerHeight
  if (chromeWidth || chromeHeight) {
   try { win.resizeTo(Math.ceil(rect.width) + chromeWidth, Math.ceil(rect.height) + chromeHeight) } catch { /* best effort only */ }
  }
 })

 // Fires whether the user closes the PiP window directly or we call pipWindow.close() ourselves —
 // single place to move the content back home and reset state.
 win.addEventListener('pagehide', () => {
  homeRef.value?.append(contentRef.value!)
  floating.value = false
  pipWindow = null
 }, { once: true })
}

function toggle() {
 if (floating.value) { pipWindow?.close(); return }
 if (!supported) { emit('unsupported'); return }
 openOverlay()
}
</script>

<template>
 <button class="icon-button" :class="{ selected: floating }" :aria-pressed="floating"
  :title="floating ? 'Agent is floating — click to bring it back' : 'Float agent overlay (experimental, Chrome/Edge only)'"
  @click="toggle">
  <Icon :name="floating ? 'PictureInPicture2' : 'PictureInPicture'" :size="18"/>
 </button>
 <div ref="homeRef" class="agent-pip-home">
  <div ref="contentRef" class="agent-pip-content">
   <div class="agent-pip-top">
    <AgentAvatar :color="color" :icon="icon" :size="52" animated/>
    <strong>{{ name }}</strong>
   </div>
   <div class="agent-pip-bubble">
    <p v-if="pending" class="agent-pip-thinking"><Icon name="Sparkles" :size="13"/>Thinking<span>•••</span></p>
    <p v-else-if="lastAnswer">{{ lastAnswer }}</p>
    <p v-else class="agent-pip-idle">Ask me something…</p>
   </div>
   <form class="agent-pip-form" @submit.prevent="submit">
    <input v-model="question" placeholder="Message…" aria-label="Message agent"/>
    <button type="submit" :disabled="!question.trim()" aria-label="Send"><Icon name="ArrowUp" :size="16"/></button>
   </form>
  </div>
 </div>
</template>

<style scoped>
/* Off-screen (not display:none) in the main page, so it still has real layout and can be measured
   before the PiP window opens — it's only ever actually seen once moved into that window's document. */
.agent-pip-home { position: fixed; top: 0; left: -9999px; }
.agent-pip-content {
 display: flex; flex-direction: column; gap: 12px;
 box-sizing: border-box; width: 290px; padding: 16px;
 font-family: 'DM Sans', sans-serif; color: #d8dfec;
 background: linear-gradient(155deg, #0b1527cc, #081321cc 70%);
 backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}
.agent-pip-top { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.agent-pip-top strong { font-size: 14px; }
.agent-pip-bubble {
 /* Capped relative to whatever window it's currently in (not a fixed px value) — at open time this
    never binds, since the window was just sized to fit; it only kicks in if content grows afterward,
    when the window itself can no longer resize (see openOverlay), so the bubble scrolls instead of
    pushing the input out of view. */
 flex-shrink: 0; max-height: 50vh; overflow-y: auto;
 background: #0d1829b3; border: 1px solid #253249cc; border-radius: 12px; padding: 12px 14px;
 font-size: 12.5px; line-height: 1.65;
}
.agent-pip-bubble p { margin: 0; white-space: pre-wrap; }
.agent-pip-thinking { display: flex; align-items: center; gap: 6px; color: #b49be9; }
.agent-pip-thinking span { animation: agent-pip-pulse 1.2s infinite; letter-spacing: 3px; }
@keyframes agent-pip-pulse { 50% { opacity: .2; } }
.agent-pip-idle { color: #7d8da8; }
.agent-pip-form { display: flex; gap: 8px; flex-shrink: 0; }
.agent-pip-form input { flex: 1; min-width: 0; background: #0d1829b3; border: 1px solid #253249cc; border-radius: 8px; padding: 9px 11px; color: #edf0f8; font-size: 12.5px; }
.agent-pip-form input::placeholder { color: #71809a; }
.agent-pip-form button { flex-shrink: 0; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #9868f7, #6245e4); border-radius: 8px; color: #fff; }
.agent-pip-form button:disabled { opacity: .45; }
</style>
