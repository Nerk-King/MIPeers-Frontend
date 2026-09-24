<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getKnowledgeTree } from '../services/knowledge'
import { uploadRevision } from '../services/uploads'
import type { KnowledgeDocument, KnowledgeNode } from '../data'
import Icon from './Icon.vue'
import KnowledgeTreeNode from './KnowledgeTreeNode.vue'

defineProps<{ active?: string[] }>()
const emit = defineEmits<{ open: [doc: KnowledgeDocument] }>()

const tree = ref<KnowledgeNode[]>([])
const docs = ref<KnowledgeDocument[]>([])
const loading = ref(true)
const error = ref('')

onMounted(load)
watch(uploadRevision, load)
async function load() {
 loading.value = true
 error.value = ''
 try {
  const data = await getKnowledgeTree()
  tree.value = data.tree
  docs.value = data.documents
 } catch {
  error.value = 'Could not load the knowledge library. Please try again.'
 } finally {
  loading.value = false
 }
}
</script>
<template>
 <div class="knowledge-tree">
  <p v-if="loading" class="tree-status"><Icon name="Sparkles" :size="14"/> Loading knowledge sources…</p>
  <p v-else-if="error" class="tree-status tree-error">{{ error }}</p>
  <template v-else>
   <KnowledgeTreeNode v-for="node in tree" :key="node.id" :node="node" :active="active" :documents="docs" :expanded="true" @open="emit('open', $event)"/>
  </template>
 </div>
</template>
