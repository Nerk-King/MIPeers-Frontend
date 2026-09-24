<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{ color?: string; icon?: string; size?: number; animated?: boolean }>(), {
 color: 'purple', size: 24, animated: true,
})
const uid = useId()
const shell = 'pet-shell-' + uid
const face = 'pet-face-' + uid
const role = computed(() => props.icon === 'Code2' ? 'developer' : props.icon === 'Briefcase' ? 'business' : 'buddy')
const accent = computed(() => ({ purple: '#bc96ff', blue: '#79bfff', green: '#6aefbb' }[props.color] || '#bc96ff'))
const detailed = computed(() => props.size >= 30)
</script>

<template>
 <svg :width="size" :height="size" viewBox="0 0 112 112" fill="none" aria-hidden="true"
  :class="['agent-pet', 'pet-' + role, { 'is-animated': animated }]">
  <defs>
   <linearGradient :id="shell" x1="27" y1="24" x2="89" y2="87" gradientUnits="userSpaceOnUse">
    <stop stop-color="#d1f967"/><stop offset=".42" stop-color="#85d332"/><stop offset=".72" stop-color="#22c8b7"/><stop offset="1" stop-color="#078ca9"/>
   </linearGradient>
   <linearGradient :id="face" x1="34" y1="32" x2="75" y2="63" gradientUnits="userSpaceOnUse">
    <stop stop-color="#12485e"/><stop offset="1" stop-color="#071b32"/>
   </linearGradient>
  </defs>
  <ellipse class="pet-shadow" cx="56" cy="103" rx="30" ry="4" fill="#031321" opacity=".32"/>
  <g class="pet-body" stroke="#092d42" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
   <!-- Little tank treads and lime/teal shell echo the login mascot. -->
   <g fill="#163e55">
    <rect x="28" y="84" width="19" height="17" rx="8" transform="rotate(9 37 92)"/>
    <rect x="65" y="84" width="19" height="17" rx="8" transform="rotate(-9 74 92)"/>
   </g>
   <path d="M33 90h8m-7 5h7m30-5h8m-9 5h7" stroke="#438494" stroke-width="2"/>
   <rect x="31" y="62" width="50" height="29" rx="14" :fill="'url(#' + shell + ')'"/>
   <path d="M39 83q17 8 34 0" stroke="#8ce6b5" opacity=".65"/>
   <g v-if="role === 'buddy'">
    <path d="M35 63q20 10 42 0l-2 10q-20 6-38-1Z" :fill="accent"/>
    <path class="pet-scarf" d="M73 67q13-2 19 5l-7 3 2 7-16-9Z" :fill="accent"/>
    <path d="m55 75-5 7h6l-2 6 9-9h-6l3-4" fill="#edffc8" stroke="none"/>
   </g>
   <g v-else-if="role === 'business'">
    <path d="m34 66 10-2 12 8 12-8 10 2-4 21H38Z" fill="#234c73"/>
    <path d="m44 64 12 8-8 5Zm24 0-12 8 8 5Z" fill="#e2f6ee" stroke-width="1.5"/>
    <path d="m56 72-4 5 2 10h4l2-10Z" :fill="accent" stroke-width="1.5"/>
   </g>
   <g v-else>
    <path d="M36 65q20-7 40 0l3 22H33Z" fill="#266264"/>
    <path d="m40 65 16 9 16-9M50 71v8m12-8v8" :stroke="accent" stroke-width="2"/>
   </g>
   <g class="pet-head">
    <path d="M56 25v-9" stroke="#79b8b9" stroke-width="3"/>
    <circle cx="56" cy="13" r="5" fill="#b6ed51"/>
    <circle cx="55" cy="12" r="1.6" fill="#f0ffd5" stroke="none"/>
    <rect x="21" y="37" width="12" height="20" rx="6" fill="#0c99ac"/>
    <rect x="79" y="37" width="12" height="20" rx="6" fill="#0c99ac"/>
    <rect x="26" y="23" width="60" height="46" rx="21" :fill="'url(#' + shell + ')'"/>
    <path d="M34 34q4-8 14-7" stroke="#eeffc2" stroke-width="3" opacity=".8"/>
    <rect x="32" y="32" width="48" height="30" rx="13" :fill="'url(#' + face + ')'"/>
    <path d="M39 37q9-4 18-2" stroke="#27889a" stroke-width="2" opacity=".55"/>
    <g class="pet-eyes" stroke="#64f5f5" stroke-width="4">
     <path d="M42 46q3-7 6 0M64 46q3-7 6 0"/>
    </g>
    <path d="M50 53q6 7 12 0" fill="#64f5f5" stroke="#64f5f5" stroke-width="1.5"/>
    <g fill="#b0f25b" stroke="none" opacity=".7"><ellipse cx="40" cy="52" rx="3" ry="1.7"/><ellipse cx="72" cy="52" rx="3" ry="1.7"/></g>
    <g v-if="role === 'business'" :stroke="accent" stroke-width="1.7">
     <rect x="37" y="39" width="15" height="12" rx="5"/><rect x="60" y="39" width="15" height="12" rx="5"/><path d="M52 43h8"/>
    </g>
    <g v-if="role === 'developer'">
     <path d="M23 44v-5a33 25 0 0 1 66 0v5" stroke="#132f44" stroke-width="5"/>
     <rect x="19" y="39" width="10" height="19" rx="5" :fill="accent"/><rect x="83" y="39" width="10" height="19" rx="5" :fill="accent"/>
     <path d="M88 56q0 9-15 9" :stroke="accent"/><rect x="68" y="62" width="8" height="5" rx="2.5" fill="#15394a" stroke-width="1.5"/>
    </g>
   </g>
   <g v-if="role === 'buddy'" class="pet-wave">
    <path d="M32 73q-16 3-16-15" stroke="#0b3449" stroke-width="8"/><path d="M32 73q-16 3-16-15" stroke="#46b9b8" stroke-width="4"/>
    <path d="M12 57 9 51m7 5v-8m4 9 4-6" stroke="#81dcca" stroke-width="4"/>
    <circle cx="16" cy="58" r="5" fill="#a6e553"/>
   </g>
   <g v-else><path d="M33 70q-12 3-7 13m53-13q12 3 7 13" stroke="#46b9b8" stroke-width="6"/></g>
   <g v-if="role === 'buddy'"><path d="M79 73q9 0 6 9" stroke="#46b9b8" stroke-width="5"/><circle cx="83" cy="83" r="5" fill="#a6e553"/></g>
   <g v-if="role === 'business' && detailed">
    <rect x="68" y="70" width="22" height="26" rx="3" fill="#e5f6e5" transform="rotate(9 79 83)"/>
    <rect x="74" y="68" width="10" height="5" rx="2" :fill="accent" stroke-width="1.5"/>
    <path d="m73 80 2 2 4-4m-6 10 2 2 4-4" stroke="#219e81" stroke-width="2"/><path d="M82 81h3m-3 7h3" stroke="#6696a2" stroke-width="1.5"/>
    <circle cx="88" cy="83" r="4" fill="#a6e553"/>
   </g>
   <g v-if="role === 'developer' && detailed">
    <path d="m34 79 4 17h36l4-17Z" fill="#122d43"/>
    <path d="M33 97h46" :stroke="accent" stroke-width="3"/>
    <path d="m49 84-4 3 4 3m14-6 4 3-4 3m-5-7-4 8" :stroke="accent" stroke-width="1.7"/>
    <ellipse class="pet-paw pet-paw-left" cx="34" cy="79" rx="5" ry="4" fill="#a6e553"/><ellipse class="pet-paw pet-paw-right" cx="78" cy="79" rx="5" ry="4" fill="#a6e553"/>
   </g>
  </g>
  <g v-if="detailed" class="pet-spark" :stroke="accent" stroke-width="2" stroke-linecap="round">
   <path v-if="role === 'buddy'" d="M94 28v8m-4-4h8M16 23v4m-2-2h4"/>
   <path v-else-if="role === 'business'" d="m94 29 3 3 6-7"/>
   <path v-else d="m12 28-4 4 4 4m85-8 4 4-4 4"/>
  </g>
 </svg>
</template>

<style scoped>
.agent-pet { display: block; flex-shrink: 0; overflow: visible; }
.pet-body { transform-origin: 56px 96px; }
.pet-head { transform-origin: 56px 64px; }
.pet-eyes { transform-origin: 56px 44px; }
.pet-wave { transform-origin: 31px 72px; }
.pet-scarf { transform-origin: 73px 69px; }
.pet-shadow { transform-origin: 56px 103px; }
@media (prefers-reduced-motion: no-preference) {
 .is-animated .pet-eyes { animation: pet-blink 5.6s infinite; }
 .is-animated.pet-buddy .pet-body { animation: pet-hop 2.8s ease-in-out infinite; }
 .is-animated.pet-buddy .pet-wave { animation: pet-wave 2.8s ease-in-out infinite; }
 .is-animated.pet-buddy .pet-scarf { animation: pet-scarf 2.8s ease-in-out infinite; }
 .is-animated.pet-buddy .pet-shadow { animation: pet-shadow 2.8s ease-in-out infinite; }
 .is-animated.pet-business .pet-head { animation: pet-nod 6s ease-in-out infinite; }
 .is-animated.pet-business .pet-eyes { animation-delay: 1.3s; }
 .is-animated.pet-developer .pet-head { animation: pet-focus 4s ease-in-out infinite; }
 .is-animated.pet-developer .pet-eyes { animation-delay: 2.4s; }
 .is-animated .pet-paw-left { animation: pet-type .7s ease-in-out infinite; }
 .is-animated .pet-paw-right { animation: pet-type .7s ease-in-out -.35s infinite; }
 .is-animated .pet-spark { animation: pet-twinkle 3s ease-in-out infinite; }
}
@keyframes pet-hop { 0%, 60%, 100% { transform: translateY(0); } 25% { transform: translateY(-5px) rotate(-3deg); } 42% { transform: translateY(0) scale(1.025,.975); } }
@keyframes pet-wave { 0%, 55%, 100% { transform: rotate(0); } 15%, 35% { transform: rotate(17deg); } 25%, 45% { transform: rotate(-9deg); } }
@keyframes pet-scarf { 0%, 60%, 100% { transform: rotate(0); } 25% { transform: rotate(-16deg); } }
@keyframes pet-shadow { 0%, 60%, 100% { transform: scaleX(1); opacity: .32; } 25% { transform: scaleX(.8); opacity: .2; } }
@keyframes pet-blink { 0%, 43%, 48%, 100% { transform: scaleY(1); } 45%, 46% { transform: scaleY(.1); } }
@keyframes pet-nod { 0%, 60%, 100% { transform: rotate(0); } 70%, 86% { transform: translateY(2px) rotate(3deg); } 78%, 94% { transform: translateY(0); } }
@keyframes pet-focus { 0%, 100% { transform: rotate(-3deg); } 50% { transform: translateY(1px) rotate(3deg); } }
@keyframes pet-type { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes pet-twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
</style>
