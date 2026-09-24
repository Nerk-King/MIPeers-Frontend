<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

export type UploadSource = 'file' | 'folder' | 'links' | 'text' | 'sitemap' | 'qa'

const emit = defineEmits<{ select: [source: UploadSource, files?: File[]]; synchronize: [] }>()

const sources: { id: UploadSource; label: string; icon: string }[] = [
 { id: 'file', label: 'File', icon: 'FileText' },
 { id: 'folder', label: 'Folder', icon: 'Folder' },
 { id: 'links', label: 'Links', icon: 'Link' },
 { id: 'text', label: 'Text resources', icon: 'File' },
 { id: 'sitemap', label: 'Sitemap', icon: 'Globe' },
 { id: 'qa', label: 'Q&A', icon: 'MessagesSquare' }
]

const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)

function choose(source: UploadSource) {
 if (source === 'file') fileInput.value?.click()
 else if (source === 'folder') folderInput.value?.click()
 else emit('select', source)
}

function picked(source: UploadSource, event: Event) {
 const input = event.target as HTMLInputElement
 const files = Array.from(input.files || [])
 if (files.length) emit('select', source, files)
 input.value = ''
}
</script>
<template>
 <section class="upload-data" aria-labelledby="upload-data-title">
  <h2 id="upload-data-title">Upload data</h2>
  <p class="upload-intro">You can directly upload your files, links, resources or folder</p>
  <div class="upload-grid">
   <button v-for="s in sources" :key="s.id" type="button" class="upload-tile" @click="choose(s.id)">
    <Icon :name="s.icon" :size="24"/>
    <span>{{ s.label }}</span>
   </button>
  </div>
  <div class="sync-note">
   <span>To synchronize data from third-party sources or local folders, head to the Synchronize section.</span>
   <button type="button" class="sync-go" @click="emit('synchronize')">Go</button>
  </div>
  <input ref="fileInput" type="file" multiple hidden @change="picked('file', $event)"/>
  <input ref="folderInput" type="file" webkitdirectory multiple hidden @change="picked('folder', $event)"/>
 </section>
</template>
<style scoped>
.upload-data{margin-bottom:28px}
.upload-data h2{font-family:Manrope,sans-serif;font-size:20px;font-weight:700;margin:0 0 14px}
.upload-intro{color:var(--muted);margin:0 0 22px;font-size:13px}
.upload-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
.upload-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;aspect-ratio:1/1;width:100%;height:auto;padding:12px;border:1px solid #1c283a;border-radius:10px;background:#0d1728;color:#dfe5f1;font-size:12.5px;text-align:center}
.upload-tile:hover{border-color:#a18bff66;background:#111d33}
.upload-tile:focus-visible{outline:2px solid var(--purple);outline-offset:2px}
.upload-tile svg{color:#c7cfdf}
.sync-note{display:flex;align-items:center;gap:12px;margin-top:22px;padding:12px 14px;border:1px solid #263147;border-radius:10px;background:#0b1424;color:var(--muted);font-size:13px}
.sync-note span{flex:1}
.sync-go{width:auto;height:32px;padding:0 16px;border:1px solid #33415a;border-radius:6px;background:#131f33;color:#edf0f8;font-weight:600;font-size:13px}
.sync-go:hover{border-color:#a18bff88}
@media(max-width:1000px){.upload-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){.sync-note{flex-direction:column;align-items:flex-start}}
</style>
