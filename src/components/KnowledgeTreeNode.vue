<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import KnowledgeTreeNode from './KnowledgeTreeNode.vue'
import type { KnowledgeDocument, KnowledgeNode } from '../data'

const props = defineProps<{ node: KnowledgeNode; active?: string[]; documents: KnowledgeDocument[]; expanded?: boolean }>()
const emit = defineEmits<{ open: [doc: KnowledgeDocument] }>()

const open = ref(!!props.expanded)
function toggle() { open.value = !open.value }
function openFile() {
 if (props.node.type !== 'file') return
 const doc = props.documents.find(d => d.id === (props.node as { documentId: string }).documentId)
 if (doc) emit('open', doc)
}
</script>
<template>
 <div v-if="node.type === 'folder'">
  <button class="tree-folder" @click="toggle" :aria-expanded="open">
   <Icon :name="open ? 'ChevronDown' : 'ChevronRight'" :size="14"/>
   <Icon name="Folder" :size="18"/>
   <span>{{ node.name }}</span>
   <small v-if="!node.children.length" class="tree-empty">Empty</small>
  </button>
  <div v-if="open && node.children.length" class="tree-children">
   <KnowledgeTreeNode v-for="child in node.children" :key="child.id" :node="child" :active="active" :documents="documents" @open="emit('open', $event)"/>
  </div>
 </div>
 <button v-else :class="['tree-file', { cited: active?.includes(node.documentId) }]" @click="openFile">
  <Icon name="FileText" :size="15"/>
  <span>{{ node.name }}</span>
  <small v-if="active?.includes(node.documentId)">cited</small>
 </button>
</template>
