<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { createResource, fileResources, linkResources, sitemapResources, saveResources, MAX_BATCH_SIZE, MAX_FILE_SIZE, MAX_RESOURCES, type UploadSource } from '../services/uploads'

const emit = defineEmits<{ saved: [count: number]; busy: [value: boolean] }>()
const sources: { id: UploadSource; label: string; icon: string; description: string }[] = [
 { id: 'file', label: 'File', icon: 'FileText', description: 'Documents & more' },
 { id: 'folder', label: 'Folder', icon: 'Folder', description: 'Keep files together' },
 { id: 'links', label: 'Links', icon: 'Link', description: 'Save web references' },
 { id: 'text', label: 'Text resources', icon: 'File', description: 'Notes & knowledge' },
 { id: 'sitemap', label: 'Sitemap', icon: 'Globe', description: 'Import page links' },
 { id: 'qa', label: 'Q&A', icon: 'MessagesSquare', description: 'Questions & answers' },
]
const source = ref<UploadSource>('file')
const files = ref<File[]>([])
const title = ref(''), text = ref(''), links = ref(''), sitemap = ref('')
const pairs = ref([{ id: crypto.randomUUID(), question: '', answer: '' }])
const error = ref(''), success = ref(''), busy = ref(false), dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null), folderInput = ref<HTMLInputElement | null>(null)
const totalBytes = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))
const selection = computed(() => sources.find(item => item.id === source.value)!)
const canSave = computed(() => {
 if (busy.value) return false
 if (source.value === 'file' || source.value === 'folder') return files.value.length > 0
 if (source.value === 'links') return !!links.value.trim()
 if (source.value === 'sitemap') return !!sitemap.value.trim()
 if (source.value === 'text') return !!title.value.trim() && !!text.value.trim()
 return pairs.value.every(pair => pair.question.trim() && pair.answer.trim())
})
watch(source, () => { error.value = ''; success.value = ''; files.value = [] })
function addPair() { pairs.value.push({ id: crypto.randomUUID(), question: '', answer: '' }) }
function formatSize(size: number) { return size >= 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.ceil(size / 1024)) + ' KB' }
function stageFiles(incoming: File[]) {
 error.value = ''; success.value = ''
 const key = (file: File) => [file.webkitRelativePath || file.name, file.size, file.lastModified].join(':')
 const candidates = [...new Map([...files.value, ...incoming].map(file => [key(file), file])).values()]
 if (candidates.length > MAX_RESOURCES) { error.value = 'Choose up to 100 files at a time.'; return }
 const invalid = candidates.find(file => !file.size || file.size > MAX_FILE_SIZE)
 if (invalid) { error.value = invalid.name + (!invalid.size ? ' is empty.' : ' exceeds the 20 MB per-file limit.'); return }
 if (candidates.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_SIZE) { error.value = 'Keep the total upload below 50 MB.'; return }
 files.value = candidates
}
function picked(event: Event) {
 const input = event.target as HTMLInputElement
 stageFiles(Array.from(input.files || []))
 input.value = ''
}
function dropped(event: DragEvent) {
 dragging.value = false
 if (busy.value) return
 const items = Array.from(event.dataTransfer?.items || [])
 if (items.some(item => item.webkitGetAsEntry?.()?.isDirectory)) {
  error.value = 'Use Choose folder to import a folder with its structure intact.'; return
 }
 stageFiles(Array.from(event.dataTransfer?.files || []))
}
async function readSitemap(event: Event) {
 const input = event.target as HTMLInputElement
 const file = input.files?.[0]
 error.value = ''; success.value = ''
 try {
  if (!file) return
  if (file.size > 2_000_000) throw new Error('Use a sitemap XML file smaller than 2 MB.')
  sitemap.value = await file.text()
 } catch (e) { error.value = e instanceof Error ? e.message : 'Could not read this sitemap.' }
 finally { input.value = '' }
}
async function submit() {
 if (!canSave.value) return
 busy.value = true; emit('busy', true); error.value = ''; success.value = ''
 try {
  const resources = source.value === 'file' || source.value === 'folder' ? await fileResources(files.value, source.value)
   : source.value === 'links' ? linkResources(links.value)
   : source.value === 'sitemap' ? sitemapResources(sitemap.value)
   : source.value === 'text' ? [createResource('text', title.value, text.value)]
   : pairs.value.map(pair => createResource('qa', pair.question, 'Question: ' + pair.question.trim() + '\n\nAnswer: ' + pair.answer.trim()))
  await saveResources(resources)
  success.value = resources.length + (resources.length === 1 ? ' resource saved' : ' resources saved') + ' to your local library.'
  if (source.value === 'file' || source.value === 'folder') files.value = []
  if (source.value === 'links') links.value = ''
  if (source.value === 'sitemap') sitemap.value = ''
  if (source.value === 'text') { title.value = ''; text.value = '' }
  if (source.value === 'qa') pairs.value = [{ id: crypto.randomUUID(), question: '', answer: '' }]
  emit('saved', resources.length)
 } catch (e) { error.value = e instanceof Error ? e.message : 'Could not save these resources. Please try again.' }
 finally { busy.value = false; emit('busy', false) }
}
</script>

<template>
 <div class="upload-data">
  <p class="upload-intro">Give your knowledge a home. Choose a source to add to your library.</p>
  <div class="upload-local-note"><Icon name="Shield" :size="18"/><span><strong>Saved on this device</strong>Resources stay in this browser. They are not synced or indexed for AI answers.</span></div>
  <div class="upload-grid" role="group" aria-label="Resource type">
   <button v-for="item in sources" :key="item.id" type="button" :class="['upload-tile', { selected: source === item.id }]" :aria-pressed="source === item.id" :disabled="busy" @click="source = item.id">
    <Icon :name="item.icon" :size="22"/><strong>{{ item.label }}</strong><small>{{ item.description }}</small>
   </button>
  </div>
  <form class="upload-form" @submit.prevent="submit">
   <div class="upload-form-heading"><h3>{{ selection.label }}</h3><span class="subtle">{{ source === 'file' || source === 'folder' ? 'Up to 100 files' : 'Local resource' }}</span></div>
   <fieldset :disabled="busy">
    <template v-if="source === 'file' || source === 'folder'">
     <div :class="['upload-dropzone', { dragging }]" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dropped">
      <span class="upload-drop-icon"><Icon :name="source === 'folder' ? 'Folder' : 'ArrowUp'" :size="26"/></span>
      <strong>{{ source === 'folder' ? 'Bring a whole folder' : 'Drop your files here' }}</strong>
      <p>{{ source === 'folder' ? 'Folder names are kept in your library.' : 'Or choose files from your device.' }}</p>
      <button type="button" class="outline-button" @click="source === 'folder' ? folderInput?.click() : fileInput?.click()">{{ source === 'folder' ? 'Choose folder' : 'Choose files' }}</button>
      <small>20 MB per file · 50 MB per upload</small>
     </div>
     <input ref="fileInput" type="file" multiple hidden @change="picked" aria-label="Select files"/>
     <input ref="folderInput" type="file" webkitdirectory multiple hidden @change="picked" aria-label="Select folder"/>
     <div v-if="files.length" class="upload-queue">
      <div class="upload-queue-heading"><span>{{ files.length }} selected · {{ formatSize(totalBytes) }}</span><button type="button" class="text-button" @click="files = []">Clear all</button></div>
      <ul><li v-for="(file, index) in files" :key="(file.webkitRelativePath || file.name) + index">
       <Icon name="FileText" :size="18"/><span><strong>{{ file.name }}</strong><small>{{ file.webkitRelativePath || formatSize(file.size) }}</small></span>
       <button type="button" class="icon-button" :aria-label="'Remove ' + file.name" @click="files.splice(index, 1)"><Icon name="X" :size="16"/></button>
      </li></ul>
     </div>
     <p class="upload-help">Text files get a preview. Other formats are saved as originals you can download.</p>
    </template>
    <template v-else-if="source === 'links'">
     <label class="upload-field">Web links<textarea v-model="links" rows="7" placeholder="https://example.com/guide&#10;https://example.com/policies" required maxlength="200000"/></label>
     <p class="upload-help">One HTTP or HTTPS link per line, up to 100. References are saved without downloading the pages.</p>
    </template>
    <template v-else-if="source === 'text'">
     <label class="upload-field">Title<input v-model="title" placeholder="e.g. Team onboarding notes" maxlength="200" required/></label>
     <label class="upload-field">Content<textarea v-model="text" rows="9" placeholder="Paste or write your resource…" maxlength="200000" required/></label>
     <p class="upload-help">{{ text.length.toLocaleString() }} / 200,000 characters</p>
    </template>
    <template v-else-if="source === 'sitemap'">
     <label class="upload-field">Sitemap URL or XML<textarea v-model="sitemap" rows="7" placeholder="https://example.com/sitemap.xml&#10;or paste sitemap XML…" maxlength="2000000" required/></label>
     <label class="upload-field">Or import an XML file<input type="file" accept=".xml,text/xml,application/xml" @change="readSitemap"/></label>
     <p class="upload-help">XML imports up to 100 page links. A URL saves a sitemap reference. Pages and nested sitemaps are not crawled automatically.</p>
    </template>
    <template v-else>
     <div v-for="(pair, index) in pairs" :key="pair.id" class="upload-qa">
      <div class="upload-form-heading"><strong>Pair {{ index + 1 }}</strong><button v-if="pairs.length > 1" type="button" class="icon-button" :aria-label="'Remove pair ' + (index + 1)" @click="pairs.splice(index, 1)"><Icon name="X" :size="16"/></button></div>
      <label class="upload-field">Question<input v-model="pair.question" placeholder="What does your team need to know?" maxlength="200" required/></label>
      <label class="upload-field">Answer<textarea v-model="pair.answer" rows="4" placeholder="Add a clear, useful answer…" maxlength="190000" required/></label>
     </div>
     <button type="button" class="text-button" :disabled="pairs.length >= 100" @click="addPair"><Icon name="Plus" :size="16"/>Add another Q&A</button>
    </template>
   </fieldset>
   <p v-if="error" class="upload-error" role="alert">{{ error }}</p>
   <p v-if="success" class="upload-success" role="status"><Icon name="Check" :size="18"/>{{ success }}</p>
   <div class="upload-actions"><span>{{ busy ? 'Saving your resources…' : 'Available after saving, even after a refresh.' }}</span><button class="primary-button" type="submit" :disabled="!canSave"><Icon :name="busy ? 'Clock3' : 'Plus'" :size="17"/>{{ busy ? 'Saving…' : 'Add to library' }}</button></div>
  </form>
 </div>
</template>

<style scoped>
.upload-data { --upload-surface: #101c2e; --upload-soft: #142137; --upload-text: #e0e7f3; --upload-selected: #28213f; color: var(--upload-text); }
:global([data-theme="light"] .upload-data) { --upload-surface: #fff; --upload-soft: #f3f6fc; --upload-text: #202d45; --upload-selected: #f0eafa; }
.upload-intro { color: var(--muted); font-size: 14px; line-height: 1.7; margin: 0 0 20px; }
.upload-local-note { display:flex; gap:11px; padding:14px; border:1px solid var(--line); border-radius:10px; background:var(--upload-soft); color:var(--muted); font-size:12px; line-height:1.6; margin-bottom:24px; }
.upload-local-note svg { color:var(--purple); margin-top:3px; }
.upload-local-note strong { display:block; color:var(--upload-text); margin-bottom:3px; }
.upload-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:28px; }
.upload-tile { display:flex; flex-direction:column; align-items:flex-start; gap:10px; min-height:113px; padding:15px 12px; border:1px solid var(--line); border-radius:12px; background:var(--upload-surface); color:var(--upload-text); text-align:left; }
.upload-tile strong { font-size:12px; }
.upload-tile small { font-size:10px; color:var(--muted); }
.upload-tile svg { color:var(--purple); }
.upload-tile.selected, .upload-tile:hover { border-color:var(--purple); background:var(--upload-selected); color:var(--upload-text); }
.upload-tile.selected { box-shadow:inset 0 0 0 1px var(--purple); }
.upload-form-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:0 0 15px; }
.upload-form-heading h3 { margin:0; font-size:16px; }
fieldset { border:0; margin:0; padding:0; min-width:0; }
.upload-dropzone { display:flex; flex-direction:column; align-items:center; text-align:center; padding:25px 16px; background:var(--upload-soft); border:1px dashed var(--line); border-radius:12px; }
.upload-dropzone.dragging { border-color:var(--purple); background:var(--upload-selected); }
.upload-drop-icon { display:grid; place-items:center; width:48px; height:48px; border-radius:14px; color:var(--purple); background:var(--upload-selected); margin-bottom:15px; }
.upload-dropzone strong { font-size:14px; }
.upload-dropzone p, .upload-dropzone small { color:var(--muted); font-size:12px; margin:9px 0 15px; }
.upload-dropzone small { margin:15px 0 0; font-size:11px; }
.upload-field { display:flex; flex-direction:column; gap:9px; margin-bottom:17px; font-size:12px; font-weight:600; }
.upload-field input, .upload-field textarea { width:100%; min-width:0; padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--upload-soft); color:var(--upload-text); font-weight:400; line-height:1.6; }
.upload-field textarea { resize:vertical; min-height:100px; }
.upload-field input[type=file] { font-size:11px; }
.upload-help { color:var(--muted); font-size:11px; line-height:1.8; margin:15px 0; }
.upload-queue { margin-top:18px; }
.upload-queue-heading { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:11px; }
.upload-queue ul { padding:0; list-style:none; max-height:235px; overflow:auto; }
.upload-queue li { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); }
.upload-queue li > span { flex:1; min-width:0; }
.upload-queue li strong, .upload-queue li small { display:block; overflow-wrap:anywhere; font-size:12px; }
.upload-queue li small { color:var(--muted); font-size:10px; margin-top:5px; }
.upload-qa { border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:15px; background:var(--upload-soft); }
.upload-actions { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-top:25px; padding-top:20px; border-top:1px solid var(--line); }
.upload-actions > span { max-width:180px; font-size:11px; color:var(--muted); line-height:1.6; }
.upload-actions button { white-space:nowrap; }
.upload-error { color:#f5a1b4; padding:12px; border:1px solid #a8586d; border-radius:8px; line-height:1.6; font-size:12px; margin-top:18px; }
.upload-success { display:flex; align-items:center; gap:9px; color:#69deae; padding:12px; border:1px solid #328a69; border-radius:8px; font-size:12px; margin-top:18px; }
:global([data-theme="light"] .upload-error) { color:#a12949; }
:global([data-theme="light"] .upload-success) { color:#1e7653; }
@media(max-width:420px) {
 .upload-grid { gap:7px; }
 .upload-tile { padding:12px 8px; }
 .upload-tile small { font-size:9px; }
 .upload-actions { align-items:stretch; flex-direction:column; }
 .upload-actions > span { max-width:none; }
}
</style>
