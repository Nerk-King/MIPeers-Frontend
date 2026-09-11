<script setup lang="ts">
import { ref } from 'vue'
import { documents, type KnowledgeDocument } from '../data'
import Icon from './Icon.vue'
defineProps<{ active?: string[] }>()
defineEmits<{ open: [doc: KnowledgeDocument] }>()
const closed = ref<string[]>([])
const categories = [...new Set(documents.map(d => d.category))]
const folders = (category: string) => [...new Set(documents.filter(d => d.category === category).map(d => d.folder))]
function toggle(key: string) { closed.value = closed.value.includes(key) ? closed.value.filter(k => k !== key) : [...closed.value, key] }
</script>
<template><div class="knowledge-tree"><div v-for="category in categories" :key="category"><button class="tree-folder" @click="toggle(category)" :aria-expanded="!closed.includes(category)"><Icon :name="closed.includes(category) ? 'ChevronRight' : 'ChevronDown'" :size="14"/><Icon name="Folder" :size="19"/><span>{{ category }}</span></button><div v-if="!closed.includes(category)" class="tree-level"><div v-for="folder in folders(category)" :key="folder"><button class="tree-folder" @click="toggle(folder)" :aria-expanded="!closed.includes(folder)"><Icon :name="closed.includes(folder) ? 'ChevronRight' : 'ChevronDown'" :size="13"/><Icon name="Folder" :size="17"/><span>{{ folder }}</span></button><div v-if="!closed.includes(folder)" class="tree-files"><button v-for="doc in documents.filter(d => d.folder === folder)" :key="doc.id" :class="['tree-file', { cited: active?.includes(doc.id) }]" @click="$emit('open', doc)"><Icon name="FileText" :size="15"/><span>{{ doc.name }}</span><small v-if="active?.includes(doc.id)">{{ doc.pages }}</small></button></div></div></div></div></div></template>
