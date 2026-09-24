<script setup lang="ts">
import { Home, LayoutDashboard, Clock3, Bookmark, Settings, Bot, Folder, Search, ArrowUpRight, ArrowUp, ChevronRight, ChevronDown, Plus, X, Menu, Bell, Sparkles, FileText, Copy, ThumbsUp, RotateCcw, Check, Shield, Code2, MessageCircle, SlidersHorizontal, BookOpen, Trash2, PanelRightClose, Zap, Briefcase } from 'lucide-vue-next'
defineProps<{ name: string; size?: number }>()
const icons: Record<string, any> = { Home, LayoutDashboard, Clock3, Bookmark, Settings, Bot, Folder, Search, ArrowUpRight, ArrowUp, ChevronRight, ChevronDown, Plus, X, Menu, Bell, Sparkles, FileText, Copy, ThumbsUp, RotateCcw, Check, Shield, Code2, MessageCircle, SlidersHorizontal, BookOpen, Trash2, PanelRightClose, Zap, Briefcase }
</script>
<template><component :is="icons[name] || Sparkles" :size="size || 20" :stroke-width="1.65" aria-hidden="true" /></template>
