<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

export interface FilterPair { label: string; value: string }
export interface FilterGroup { key: string; label: string; options: string[] }

/**
 * Combined "scope this question" dropdown for the chat toolbar: one button opens a panel with a
 * section per label set from ilDecision:fetchRagLabelList (client, division, product, …), each with
 * its own checkable options. Picks across every section feed pcClients as "label=value" pairs (see
 * services/rag.ts), so a question can be scoped by any combination of label sets, not just client.
 */
const props = withDefaults(defineProps<{
 groups: FilterGroup[]
 modelValue: FilterPair[]
 disabled?: boolean
 searchThreshold?: number
}>(), { searchThreshold: 8 })
const emit = defineEmits<{ 'update:modelValue': [value: FilterPair[]] }>()

const root = ref<HTMLElement | null>(null), trigger = ref<HTMLButtonElement | null>(null), searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false), query = ref('')
const totalOptions = computed(() => props.groups.reduce((sum, g) => sum + g.options.length, 0))
const searchable = computed(() => totalOptions.value > props.searchThreshold)
const filteredGroups = computed(() => {
 const q = query.value.trim().toLowerCase()
 if (!q) return props.groups
 return props.groups.map(g => ({ ...g, options: g.options.filter(o => o.toLowerCase().includes(q)) }))
})
const anyVisible = computed(() => filteredGroups.value.some(g => g.options.length))
const summary = computed(() => props.modelValue.length === 0 ? 'All documents' : props.modelValue.length === 1 ? props.modelValue[0].value : `${props.modelValue.length} filters`)

function isSelected(label: string, value: string) { return props.modelValue.some(f => f.label === label && f.value === value) }
function toggleOption(label: string, value: string) {
 const picked = isSelected(label, value) ? props.modelValue.filter(f => !(f.label === label && f.value === value)) : [...props.modelValue, { label, value }]
 emit('update:modelValue', picked)
}
function clear() { emit('update:modelValue', []); close() }
function toggle() { if (open.value) close(); else if (!props.disabled) open.value = true }
function close() { open.value = false; query.value = '' }
// Stop Escape here while open, so it doesn't also close a surrounding dialog.
function onEscape(e: KeyboardEvent) { if (!open.value) return; e.stopPropagation(); close(); trigger.value?.focus() }
function closeIfOutside(e: Event) { if (!(e.target instanceof Node && root.value?.contains(e.target))) close() }

watch(open, async value => {
 const method = value ? 'addEventListener' : 'removeEventListener'
 document[method]('pointerdown', closeIfOutside)
 document[method]('focusin', closeIfOutside)
 if (value) { await nextTick(); searchInput.value?.focus() }
})
watch(() => props.disabled, disabled => { if (disabled) close() })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', closeIfOutside); document.removeEventListener('focusin', closeIfOutside) })
</script>

<template>
 <div ref="root" class="multi-select filter-picker" @keydown.esc="onEscape">
  <button ref="trigger" type="button" class="agent-select client-select" :disabled="disabled" :aria-expanded="open" aria-haspopup="listbox" aria-label="Scope to filters" @click="toggle">
   <Icon name="SlidersHorizontal" :size="17"/><span>{{ summary }}</span><Icon name="ChevronDown" :size="16"/>
  </button>
  <div v-if="open" class="agent-options client-options filter-panel">
   <label v-if="searchable" class="ms-search"><Icon name="Search" :size="15"/><input ref="searchInput" v-model="query" placeholder="Search filters…" aria-label="Search filters"/></label>
   <div class="filter-groups">
    <button v-if="modelValue.length" type="button" class="filter-clear" @click="clear"><Icon name="X" :size="14"/>Clear all filters</button>
    <div v-for="group in filteredGroups" v-show="group.options.length" :key="group.key" class="filter-group">
     <p class="filter-group-heading">{{ group.label }}</p>
     <div class="ms-list" role="listbox" aria-multiselectable="true" :aria-label="group.label">
      <button v-for="value in group.options" :key="value" type="button" role="option" :aria-selected="isSelected(group.key, value)" @click="toggleOption(group.key, value)">
       <span>{{ value }}</span><Icon v-if="isSelected(group.key, value)" name="Check" :size="16"/>
      </button>
     </div>
    </div>
    <p v-if="!anyVisible" class="ms-empty">No filters match “{{ query }}”.</p>
   </div>
  </div>
 </div>
</template>
