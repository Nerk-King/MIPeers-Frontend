<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { knowledgeStatus, libraryDocuments as docs, libraryTree as tree, loadKnowledgeBase } from '../services/knowledge'
import { sessionToken } from '../services/auth'
import { isLive } from '../services/liveMode'
import type { KnowledgeDocument } from '../data'
import Icon from './Icon.vue'
import KnowledgeTreeNode from './KnowledgeTreeNode.vue'

defineProps<{ active?: string[] }>()
const emit = defineEmits<{ open: [doc: KnowledgeDocument] }>()

// The tree is shared state from services/knowledge: already-loaded data renders immediately, and
// local uploads/removals show up without a refetch. This only kicks off the (cached) load.
function load() { loadKnowledgeBase().catch(() => {}) }
onMounted(load)
watch([isLive, sessionToken], load)
</script>
<template>
 <div class="knowledge-tree">
  <p v-if="knowledgeStatus === 'loading' || knowledgeStatus === 'idle'" class="tree-status"><Icon name="Sparkles" :size="14"/> Loading knowledge sources…</p>
  <p v-else-if="knowledgeStatus === 'error'" class="tree-status tree-error">Could not load the knowledge library. <button type="button" class="tree-retry" @click="load">Try again</button></p>
  <template v-else>
   <KnowledgeTreeNode v-for="node in tree" :key="node.id" :node="node" :active="active" :documents="docs" :expanded="true" @open="emit('open', $event)"/>
  </template>
 </div>
</template>

<style scoped>
.tree-retry { padding: 0; color: var(--purple); font-size: inherit; text-decoration: underline; }
</style>
