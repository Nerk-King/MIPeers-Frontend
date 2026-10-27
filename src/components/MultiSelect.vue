<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

/**
 * Multi-select dropdown shared by the chat's client scope and the upload dialog. "button" shows a
 * compact summary ("All clients" / one name / "2 clients"); "field" shows the picks as removable
 * chips inside a form field. The menu stays open while ticking options and closes on an outside
 * click, focus moving elsewhere, or Escape. A search box appears once the list gets long.
 */
const props = withDefaults(defineProps<{
 options: string[]
 modelValue: string[]
 variant?: 'button' | 'field'
 icon?: string
 /** Adds an option that clears the selection, and is the button's label when nothing is picked. */
 allLabel?: string
 placeholder?: string
 /** Plural noun for the summary and search ("2 clients", "Search clients…"). */
 noun?: string
 label?: string
 disabled?: boolean
 searchThreshold?: number
}>(), { variant: 'button', icon: 'Building2', placeholder: 'None', noun: 'items', searchThreshold: 8 })
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const root = ref<HTMLElement | null>(null), trigger = ref<HTMLButtonElement | null>(null), searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false), query = ref('')
const searchable = computed(() => props.options.length > props.searchThreshold)
const filtered = computed(() => { const q = query.value.trim().toLowerCase(); return q ? props.options.filter(o => o.toLowerCase().includes(q)) : props.options })
const summary = computed(() => props.modelValue.length === 0 ? props.allLabel || props.placeholder : props.modelValue.length === 1 ? props.modelValue[0] : `${props.modelValue.length} ${props.noun}`)

// Keeps the selection in the options' order; picks no longer in the list (e.g. on an old chat) stay, last.
function toggleOption(name: string) {
 const picked = props.modelValue.includes(name) ? props.modelValue.filter(v => v !== name) : [...props.modelValue, name]
 const rank = (v: string) => { const i = props.options.indexOf(v); return i < 0 ? props.options.length : i }
 emit('update:modelValue', picked.sort((a, b) => rank(a) - rank(b)))
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
 <div ref="root" :class="['multi-select', `multi-select-${variant}`]" @keydown.esc="onEscape">
  <button v-if="variant === 'button'" ref="trigger" type="button" class="agent-select client-select" :disabled="disabled" :aria-expanded="open" aria-haspopup="listbox" :aria-label="label" @click="toggle">
   <Icon :name="modelValue.length || !allLabel ? icon : 'Globe'" :size="17"/><span>{{ summary }}</span><Icon name="ChevronDown" :size="16"/>
  </button>
  <div v-else :class="['ms-field', { open, disabled }]" @click="toggle">
   <span v-for="name in modelValue" :key="name" class="client-chip"><Icon :name="icon" :size="13"/>{{ name }}<button type="button" :disabled="disabled" :aria-label="`Remove ${name}`" @click.stop="toggleOption(name)"><Icon name="X" :size="13"/></button></span>
   <span v-if="!modelValue.length" class="ms-placeholder">{{ placeholder }}</span>
   <button ref="trigger" type="button" class="ms-toggle" :disabled="disabled" :aria-expanded="open" aria-haspopup="listbox" :aria-label="label" @click.stop="toggle"><Icon name="ChevronDown" :size="16"/></button>
  </div>
  <div v-if="open" class="agent-options client-options ms-menu">
   <label v-if="searchable" class="ms-search"><Icon name="Search" :size="15"/><input ref="searchInput" v-model="query" :placeholder="`Search ${noun}…`" :aria-label="`Search ${noun}`"/></label>
   <div class="ms-list" role="listbox" aria-multiselectable="true" :aria-label="label">
    <button v-if="allLabel && !query" type="button" role="option" :aria-selected="!modelValue.length" @click="clear"><Icon name="Globe" :size="16"/><span>{{ allLabel }}</span><Icon v-if="!modelValue.length" name="Check" :size="16"/></button>
    <button v-for="name in filtered" :key="name" type="button" role="option" :aria-selected="modelValue.includes(name)" @click="toggleOption(name)"><Icon :name="icon" :size="16"/><span>{{ name }}</span><Icon v-if="modelValue.includes(name)" name="Check" :size="16"/></button>
    <p v-if="!filtered.length" class="ms-empty">No {{ noun }} match “{{ query }}”.</p>
   </div>
  </div>
 </div>
</template>
