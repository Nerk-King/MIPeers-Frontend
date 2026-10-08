<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { fetchRagLabels, ragUpload, type RagLabels } from '../services/ragUpload'
import { isLive } from '../services/liveMode'

const emit = defineEmits<{ close: []; uploaded: [count: number] }>()

type EntryStatus = 'pending' | 'uploading' | 'done' | 'error'
type Entry = { id: string; file: File; summary: string; status: EntryStatus; error?: string }

const entries = ref<Entry[]>([])
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
// Shared by every file in this batch; the summary is captured per file on its queue row.
const product = ref('')
const folder = ref('')
const agents = ref<string[]>([])
// Products, their folders and the agents all come from ilDecision:fetchRagLabelList; the folder
// list follows whichever product is chosen.
const labels = ref<RagLabels>({ products: {}, agents: [] })
const labelsState = ref<'loading' | 'ready' | 'error'>('loading')
const labelsError = ref('')
const agentOptions = computed(() => labels.value.agents)
const productOptions = computed(() => Object.keys(labels.value.products))
const folderOptions = computed(() => labels.value.products[product.value] ?? [])
watch(product, () => { if (!folderOptions.value.includes(folder.value)) folder.value = '' })

onMounted(loadLabels)

async function loadLabels() {
 labelsState.value = 'loading'; labelsError.value = ''
 try {
  labels.value = await fetchRagLabels()
  labelsState.value = 'ready'
 } catch (e) {
  labelsError.value = e instanceof Error ? e.message : 'Could not load the product and folder lists.'
  labelsState.value = 'error'
 }
}

function stage(files: File[]) {
 const next = files.map(file => ({ id: uuidv4(), file, summary: '', status: 'pending' as EntryStatus }))
 entries.value = [...entries.value, ...next]
}
function picked(event: Event) {
 const input = event.target as HTMLInputElement
 stage(Array.from(input.files || []))
 input.value = ''
}
function dropped(event: DragEvent) {
 dragging.value = false
 stage(Array.from(event.dataTransfer?.files || []))
}
function removeEntry(id: string) { entries.value = entries.value.filter(entry => entry.id !== id) }

async function uploadAll() {
 if (busy.value) return
 busy.value = true
 let succeeded = 0
 for (const entry of entries.value) {
  if (entry.status === 'done') { succeeded++; continue }
  entry.status = 'uploading'; entry.error = undefined
  try {
   await ragUpload(entry.file, { product: product.value, folder: folder.value, summary: entry.summary, agent: agentOptions.value.filter(option => agents.value.includes(option)).join(',') })
   entry.status = 'done'
   succeeded++
  } catch (e) {
   entry.status = 'error'
   entry.error = e instanceof Error ? e.message : 'Upload failed.'
  }
 }
 busy.value = false
 if (succeeded) emit('uploaded', succeeded)
}
</script>

<template>
 <div class="overlay" @click.self="emit('close')">
  <section class="drawer upload-drawer" role="dialog" aria-modal="true" aria-labelledby="rag-upload-title">
   <div class="drawer-heading">
    <div><span class="eyebrow">SHARE YOUR KNOWLEDGE</span><h2 id="rag-upload-title">Send to knowledge base</h2></div>
    <button class="icon-button" :disabled="busy" aria-label="Close" @click="emit('close')"><Icon name="X"/></button>
   </div>

   <p class="subtle rag-upload-intro">Add documents for your team to find answers from.</p>
   <div v-if="!isLive" class="rag-upload-note"><Icon name="Shield" :size="18"/><span><strong>Demo mode</strong>The real ingestion call is simulated. Switch to Live at the top of the screen to use the real service.</span></div>

   <p v-if="labelsState === 'loading'" class="subtle rag-upload-labels-status">Loading products and folders…</p>
   <div v-else-if="labelsState === 'error'" class="rag-upload-labels-error" role="alert"><span>{{ labelsError }}</span><button type="button" class="outline-button" @click="loadLabels">Try again</button></div>
   <div v-else class="rag-upload-fields">
    <label class="rag-upload-field"><span>Product <small>(optional)</small></span><select v-model="product" :disabled="busy"><option value="">No product</option><option v-for="option in productOptions" :key="option" :value="option">{{ option }}</option></select></label>
    <label class="rag-upload-field"><span>Folder <small>(optional)</small></span><select v-model="folder" :disabled="busy || !product"><option value="">{{ product ? 'No folder' : 'Choose a product first' }}</option><option v-for="option in folderOptions" :key="option" :value="option">{{ option }}</option></select></label>
    <fieldset v-if="agentOptions.length" class="rag-upload-field rag-upload-agents" :disabled="busy"><legend>Agent <small>(optional)</small></legend><label v-for="option in agentOptions" :key="option"><input v-model="agents" type="checkbox" :value="option"/>{{ option }}</label></fieldset>
   </div>

   <div :class="['upload-dropzone', { dragging }]" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dropped">
    <span class="upload-drop-icon"><Icon name="ArrowUp" :size="26"/></span>
    <strong>Drop files here</strong>
    <p>Or choose files from your device.</p>
    <button type="button" class="outline-button" :disabled="busy" @click="fileInput?.click()">Choose files</button>
   </div>
   <input ref="fileInput" type="file" multiple hidden @change="picked" aria-label="Select files to upload"/>

   <ul v-if="entries.length" class="rag-upload-queue">
    <li v-for="entry in entries" :key="entry.id">
     <Icon name="FileText" :size="18"/>
     <span><strong>{{ entry.file.name }}</strong><input v-model="entry.summary" class="rag-upload-summary" placeholder="Summary (optional)" maxlength="500" :disabled="busy || entry.status === 'done'" :aria-label="'Summary for ' + entry.file.name"/><small v-if="entry.status === 'error'">{{ entry.error }}</small></span>
     <span :class="['rag-upload-status-badge', entry.status]">
      <Icon v-if="entry.status === 'done'" name="Check" :size="14"/>
      <Icon v-else-if="entry.status === 'error'" name="X" :size="14"/>
      {{ entry.status === 'pending' ? 'Queued' : entry.status === 'uploading' ? 'Sending…' : entry.status === 'done' ? 'Done' : 'Failed' }}
     </span>
     <button class="icon-button" :disabled="busy" :aria-label="'Remove ' + entry.file.name" @click="removeEntry(entry.id)"><Icon name="X" :size="16"/></button>
    </li>
   </ul>

   <div class="rag-upload-actions">
    <span>{{ busy ? 'Uploading…' : !entries.length ? 'Choose files to begin' : entries.length + ' file(s) ready' }}</span>
    <button class="primary-button" :disabled="!entries.length || busy" @click="uploadAll"><Icon :name="busy ? 'Clock3' : 'ArrowUp'" :size="17"/>{{ busy ? 'Uploading…' : 'Upload' }}</button>
   </div>
  </section>
 </div>
</template>

<style scoped>
.rag-upload-intro { margin-bottom: 18px; }
.rag-upload-note { display: flex; gap: 11px; padding: 14px; border: 1px solid #8a5a22; border-radius: 10px; background: #3a2a12; color: #f3c177; font-size: 12px; line-height: 1.6; margin-bottom: 20px; }
.rag-upload-note svg { color: #efb166; margin-top: 3px; }
.rag-upload-note strong { display: block; font-weight: 600; margin-bottom: 3px; }
:global([data-theme="light"] .rag-upload-note) { border-color: #e0a458; background: #fdf1e0; color: #8a5a22; }
:global([data-theme="light"] .rag-upload-note svg) { color: #b9752c; }
.rag-upload-labels-status { font-size: 12px; margin-bottom: 16px; }
.rag-upload-labels-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #a8586d; border-radius: 8px; color: #f5a1b4; font-size: 12px; line-height: 1.6; margin-bottom: 16px; }
:global([data-theme="light"] .rag-upload-labels-error) { color: #a12949; }
.rag-upload-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
.rag-upload-field { display: flex; flex-direction: column; gap: 7px; font-size: 12px; font-weight: 600; }
.rag-upload-field input, .rag-upload-field select, .rag-upload-summary { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: inherit; font: inherit; font-weight: 400; }
.rag-upload-agents { margin: 0; padding: 0; border: 0; min-width: 0; }
.rag-upload-agents legend { padding: 0; margin-bottom: 7px; }
.rag-upload-field > span small, .rag-upload-agents legend small { color: var(--muted); font-weight: 400; }
.rag-upload-agents label { display: inline-flex; align-items: center; gap: 7px; margin: 8px 16px 0 0; font-weight: 400; cursor: pointer; }
.rag-upload-agents input { width: auto; padding: 0; accent-color: var(--purple); }
.rag-upload-summary { padding: 7px 10px; font-size: 11px; }
.rag-upload-actions { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); text-align: center; }
.rag-upload-actions > span { color: var(--muted); font-size: 11px; }
.rag-upload-actions > button { min-width: 200px; justify-content: center; }
.upload-dropzone { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 25px 16px; background: var(--panel); border: 1px dashed var(--line); border-radius: 12px; margin-bottom: 16px; }
.upload-dropzone.dragging { border-color: var(--purple); }
.upload-drop-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; color: var(--purple); background: #221b3c; margin-bottom: 15px; }
.upload-dropzone strong { font-size: 14px; }
.upload-dropzone p { color: var(--muted); font-size: 12px; margin: 9px 0 15px; }
.rag-upload-queue { list-style: none; padding: 0; margin: 0 0 16px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.rag-upload-queue li { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid var(--line); }
.rag-upload-queue li:last-child { border-bottom: 0; }
.rag-upload-queue li > span:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rag-upload-queue li strong { font-size: 12px; overflow-wrap: anywhere; }
.rag-upload-queue li small { color: #f5a1b4; font-size: 10px; }
.rag-upload-status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); white-space: nowrap; }
.rag-upload-status-badge.done { color: #42dba4; }
.rag-upload-status-badge.error { color: #f5a1b4; }
.rag-upload-status-badge.uploading { color: var(--purple); }
</style>
