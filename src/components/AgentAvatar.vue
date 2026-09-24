<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{ color?: string; icon?: string; size?: number; animated?: boolean }>(), { color: 'purple', size: 24, animated: false })

const uid = useId()
const headGrad = `av-head-${uid}`
const bodyGrad = `av-body-${uid}`

const palettes: Record<string, { headA: string; headB: string; bodyA: string; bodyB: string; screen: string; eye: string; core: string }> = {
 purple: { headA: '#c6b0ff', headB: '#8a63f2', bodyA: '#7d5aef', bodyB: '#4a34ad', screen: '#251b40', eye: '#e3d9ff', core: '#b79bff' },
 blue: { headA: '#9cc6ff', headB: '#4f8ffc', bodyA: '#3f7ff2', bodyB: '#1d4aa8', screen: '#0f2338', eye: '#cfe7ff', core: '#7fb4ff' },
 green: { headA: '#8fedca', headB: '#34d399', bodyA: '#22c08e', bodyB: '#128063', screen: '#0f2b22', eye: '#d3fff0', core: '#6be0b8' },
}

const p = computed(() => palettes[props.color] || palettes.purple)

const eyeStyle = computed(() => {
 if (props.icon === 'Zap') return 'spark'
 if (props.icon === 'Code2') return 'brackets'
 return 'flat'
})
</script>

<template>
 <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" role="img" aria-hidden="true" :class="{ 'avatar-bob': animated }">
  <defs>
   <linearGradient :id="headGrad" x1="8" y1="2" x2="24" y2="16" gradientUnits="userSpaceOnUse">
    <stop offset="0" :stop-color="p.headA"/>
    <stop offset="1" :stop-color="p.headB"/>
   </linearGradient>
   <linearGradient :id="bodyGrad" x1="8" y1="17" x2="24" y2="29" gradientUnits="userSpaceOnUse">
    <stop offset="0" :stop-color="p.bodyA"/>
    <stop offset="1" :stop-color="p.bodyB"/>
   </linearGradient>
  </defs>

  <g :class="{ 'avatar-sway': animated }">
   <line x1="16" y1="3" x2="16" y2="0.6" :stroke="p.headB" stroke-width="1.4" stroke-linecap="round"/>
   <template v-if="eyeStyle === 'spark'">
    <path d="M16 0.3 L14.9 2.1 L15.9 2.1 L14.9 4 L17.4 1.7 L16.2 1.7 Z" :fill="p.core"/>
   </template>
   <circle v-else cx="16" cy="0.9" r="1.15" :fill="p.core"/>
  </g>

  <circle cx="6.2" cy="9.5" r="2.1" :fill="p.headB"/>
  <circle cx="25.8" cy="9.5" r="2.1" :fill="p.headB"/>

  <rect x="7" y="3" width="18" height="13" rx="6.2" :fill="`url(#${headGrad})`"/>

  <rect x="10" y="6.2" width="12" height="7.4" rx="3.6" :fill="p.screen"/>

  <template v-if="animated">
   <path d="M12.3 7.3 Q13.6 6.1 15 7" :stroke="p.core" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".85"/>
   <path d="M19.7 7.3 Q18.4 6.1 17 7" :stroke="p.core" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".85"/>
   <g class="avatar-eye avatar-eye-left"><circle cx="13.6" cy="10" r="1.9" :fill="p.eye"/><circle cx="14.2" cy="9.35" r=".55" fill="#fff" opacity=".9"/></g>
   <g class="avatar-eye avatar-eye-right"><circle cx="18.4" cy="10" r="1.9" :fill="p.eye"/><circle cx="19" cy="9.35" r=".55" fill="#fff" opacity=".9"/></g>
   <ellipse class="avatar-mouth" cx="16" cy="12.8" rx="1.25" ry="1" :fill="p.eye" opacity=".85"/>
  </template>
  <template v-else>
   <template v-if="eyeStyle === 'brackets'">
    <path d="M13.6 8 L12.3 9.8 L13.6 11.6" :stroke="p.eye" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M18.4 8 L19.7 9.8 L18.4 11.6" :stroke="p.eye" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
   </template>
   <template v-else-if="eyeStyle === 'spark'">
    <circle cx="13.6" cy="9.8" r="1.55" :fill="p.eye"/>
    <circle cx="18.4" cy="9.8" r="1.55" :fill="p.eye"/>
    <circle cx="14.1" cy="9.2" r="0.5" fill="#fff" opacity=".85"/>
    <circle cx="18.9" cy="9.2" r="0.5" fill="#fff" opacity=".85"/>
   </template>
   <template v-else>
    <rect x="12.2" y="8.6" width="2.8" height="2.4" rx="1.2" :fill="p.eye"/>
    <rect x="17" y="8.6" width="2.8" height="2.4" rx="1.2" :fill="p.eye"/>
   </template>
   <path d="M13.3 12.6 Q16 14.3 18.7 12.6" :stroke="p.eye" stroke-width="1" stroke-linecap="round" fill="none" opacity=".8"/>
  </template>

  <circle cx="6" cy="22.5" r="2.5" :fill="p.headB"/>
  <circle cx="26" cy="22.5" r="2.5" :fill="p.headB"/>

  <rect x="8" y="17.5" width="16" height="11.5" rx="5.6" :fill="`url(#${bodyGrad})`"/>
  <rect x="13" y="20.4" width="6" height="5" rx="1.6" :fill="p.screen" opacity=".55"/>
 </svg>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
 .avatar-bob { animation: avatar-bob 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
 .avatar-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: avatar-sway 2.4s ease-in-out infinite; }
 .avatar-eye { transform-box: fill-box; transform-origin: 50% 50%; animation: avatar-blink 3.6s ease-in-out infinite; }
 .avatar-eye-right { animation-delay: .05s; }
 .avatar-mouth { transform-box: fill-box; transform-origin: 50% 50%; animation: avatar-mouth 1.7s ease-in-out infinite; }
}
@keyframes avatar-bob {
 0%, 100% { transform: translateY(0) rotate(-2deg); }
 50% { transform: translateY(-3px) rotate(2deg); }
}
@keyframes avatar-sway {
 0%, 100% { transform: rotate(-9deg); }
 50% { transform: rotate(9deg); }
}
@keyframes avatar-blink {
 0%, 88%, 100% { transform: scaleY(1); }
 93% { transform: scaleY(.15); }
}
@keyframes avatar-mouth {
 0%, 100% { transform: scale(1); }
 50% { transform: scale(1.2, .8); }
}
</style>
