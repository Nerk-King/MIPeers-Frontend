<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Icon from './Icon.vue'
import { isFileSystemAccessSupported, hasChosenUploadsFolder, getGrantedUploadsFolder, chooseUploadsFolder, requestUploadsFolderAccess, writeFileToFolder } from '../services/localFs'
import { ragUpload } from '../services/ragUpload'
import { isLive } from '../services/liveMode'

const props = defineProps<{ uploadsPath: string }>()
const emit = defineEmits<{ close: []; openSettings: []; uploaded: [count: number] }>()

type EntryStatus = 'pending' | 'writing' | 'uploading' | 'done' | 'error'
type Entry = { id: string; file: File; status: EntryStatus; error?: string }

const folderState = ref<'checking' | 'none' | 'needs-permission' | 'granted'>('checking')
const granting = ref(false)
const grantError = ref('')
const entries = ref<Entry[]>([])
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

onMounted(refreshFolderState)

async function refreshFolderState() {
 if (!isFileSystemAccessSupported) { folderState.value = 'none'; return }
 const granted = await getGrantedUploadsFolder()
 if (granted) { folderState.value = 'granted'; return }
 folderState.value = (await hasChosenUploadsFolder()) ? 'needs-permission' : 'none'
}

async function grantFolder() {
 granting.value = true; grantError.value = ''
 try {
  if (folderState.value === 'needs-permission') await requestUploadsFolderAccess()
  else await chooseUploadsFolder()
  folderState.value = 'granted'
 } catch (e) { grantError.value = e instanceof Error ? e.message : 'Could not get folder access.' }
 finally { granting.value = false }
}

function stage(files: File[]) {
 const next = files.map(file => ({ id: crypto.randomUUID(), file, status: 'pending' as EntryStatus }))
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
 const granted = await getGrantedUploadsFolder()
 if (!granted) { folderState.value = 'needs-permission'; return }
 busy.value = true
 let succeeded = 0
 for (const entry of entries.value) {
  if (entry.status === 'done') { succeeded++; continue }
  entry.status = 'writing'; entry.error = undefined
  try {
   await writeFileToFolder(granted, entry.file)
   entry.status = 'uploading'
   await ragUpload(props.uploadsPath, entry.file)
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

   <template v-if="!uploadsPath">
    <div class="rag-upload-status warn">
     <Icon name="SlidersHorizontal" :size="18"/>
     <span>Set your local uploads folder path in Settings before uploading.</span>
    </div>
    <button class="outline-button" @click="emit('openSettings')">Open Settings</button>
   </template>

   <template v-else-if="folderState === 'none' && !isFileSystemAccessSupported">
    <div class="rag-upload-status warn"><Icon name="Shield" :size="18"/><span>Your browser can't grant local folder access. Use Chrome or Edge to upload.</span></div>
   </template>

   <template v-else-if="folderState !== 'granted'">
    <div class="rag-upload-status">
     <Icon name="Folder" :size="18"/>
     <span><strong>{{ uploadsPath }}</strong><small>{{ folderState === 'needs-permission' ? 'Access needs to be reconfirmed for this folder.' : 'Choose this exact folder when the browser prompt opens.' }}</small></span>
    </div>
    <p v-if="grantError" class="upload-error" role="alert">{{ grantError }}</p>
    <button class="primary-button" :disabled="granting" @click="grantFolder"><Icon name="Folder" :size="17"/>{{ granting ? 'Waiting…' : folderState === 'needs-permission' ? 'Allow access' : 'Choose folder' }}</button>
   </template>

   <template v-else>
    <div class="rag-upload-status ok"><Icon name="Check" :size="18"/><span><strong>{{ uploadsPath }}</strong><small>Folder access granted</small></span></div>

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
      <span><strong>{{ entry.file.name }}</strong><small v-if="entry.status === 'error'">{{ entry.error }}</small></span>
      <span :class="['rag-upload-status-badge', entry.status]">
       <Icon v-if="entry.status === 'done'" name="Check" :size="14"/>
       <Icon v-else-if="entry.status === 'error'" name="X" :size="14"/>
       {{ entry.status === 'pending' ? 'Queued' : entry.status === 'writing' ? 'Saving…' : entry.status === 'uploading' ? 'Sending…' : entry.status === 'done' ? 'Done' : 'Failed' }}
      </span>
      <button class="icon-button" :disabled="busy" :aria-label="'Remove ' + entry.file.name" @click="removeEntry(entry.id)"><Icon name="X" :size="16"/></button>
     </li>
    </ul>

    <div class="rag-upload-actions">
     <span>{{ busy ? 'Uploading…' : entries.length ? entries.length + ' file(s) ready' : 'Choose files to begin' }}</span>
     <button class="primary-button" :disabled="!entries.length || busy" @click="uploadAll"><Icon :name="busy ? 'Clock3' : 'ArrowUp'" :size="17"/>{{ busy ? 'Uploading…' : 'Upload' }}</button>
    </div>
   </template>
  </section>
 </div>
</template>

<style scoped>
.rag-upload-intro { margin-bottom: 18px; }
.rag-upload-note { display: flex; gap: 11px; padding: 14px; border: 1px solid #8a5a22; border-radius: 10px; background: #3a2a12; color: #f3c177; font-size: 12px; line-height: 1.6; margin-bottom: 20px; }
.rag-upload-note svg { color: #efb166; margin-top: 3px; }
.rag-upload-note strong { display: block; font-weight: 600; margin-bottom: 3px; }
.rag-upload-status { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); margin-bottom: 16px; }
.rag-upload-status svg { color: var(--purple); margin-top: 2px; flex-shrink: 0; }
.rag-upload-status span { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.rag-upload-status small { color: var(--muted); font-size: 11px; }
.rag-upload-status.warn { border-color: #8a5a22; background: #3a2a12; }
.rag-upload-status.warn svg { color: #efb166; }
.rag-upload-status.warn span { color: #f3c177; font-weight: 600; }
.rag-upload-status.ok svg { color: #42dba4; }
:global([data-theme="light"] .rag-upload-note) { border-color: #e0a458; background: #fdf1e0; color: #8a5a22; }
:global([data-theme="light"] .rag-upload-note svg) { color: #b9752c; }
:global([data-theme="light"] .rag-upload-status.warn) { border-color: #e0a458; background: #fdf1e0; }
:global([data-theme="light"] .rag-upload-status.warn svg) { color: #b9752c; }
:global([data-theme="light"] .rag-upload-status.warn span) { color: #8a5a22; }
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
.rag-upload-status-badge.writing, .rag-upload-status-badge.uploading { color: var(--purple); }
</style>
