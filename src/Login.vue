<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, Eye, EyeOff } from 'lucide-vue-next'
import heroImage from './Mipeers logo.jpg'
import { signIn } from './services/auth'
import { isLive, toggleLive } from './services/liveMode'
import AgentAvatar from './components/AgentAvatar.vue'
const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const pending = ref(false)
async function submit() {
 if (pending.value) return
 error.value = ''
 pending.value = true
 try {
  await signIn({ username: username.value, password: password.value })
  router.push('/home')
 } catch (e) {
  error.value = e instanceof Error ? e.message : 'Unable to sign in right now. Please try again.'
 } finally {
  pending.value = false
 }
}
function dismissError() { error.value = '' }
</script>

<template>
 <div class="login-page">
  <button :class="['live-toggle', 'login-live-toggle', { live: isLive }]" :aria-pressed="isLive" @click="toggleLive"><span class="live-toggle-dot"/>{{ isLive ? 'Live' : 'Demo' }}</button>
  <section class="login-panel">
   <div class="login-brand">
    <span class="login-logo">MiP<span class="login-dot">.</span></span>
    <span class="login-caption">HUMAN SOFTWARE COMPANY</span>
   </div>
   <form class="login-form" @submit.prevent="submit" novalidate>
    <label class="login-field"><Mail :size="18" /><input v-model="username" type="text" placeholder="Username" autocomplete="username" aria-label="Username" :disabled="pending" /></label>
    <label class="login-field"><Lock :size="18" /><input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Password" autocomplete="current-password" aria-label="Password" :disabled="pending" /><button type="button" class="login-password-toggle" :aria-label="showPassword ? 'Hide password' : 'Show password'" :disabled="pending" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></label>
    <div class="login-links"><a href="#" class="login-forgot" @click.prevent>Forgot your password?</a></div>
    <p class="login-register"><span>Don't have an account?</span> <a href="#" @click.prevent>Register</a></p>
    <button type="submit" class="login-submit" :disabled="pending">{{ pending ? 'Signing in…' : 'Login' }}</button>
   </form>
  </section>

  <section class="login-hero" :style="{ backgroundImage: `url(${heroImage})` }" role="img" aria-label="MIPeers, your everyday work assistant"></section>

  <div v-if="error" class="login-error-overlay" @click.self="dismissError">
   <div class="login-error-modal" role="alertdialog" aria-modal="true" aria-label="Sign-in error">
    <AgentAvatar color="purple" :size="76" sad/>
    <h3>We couldn't sign you in</h3>
    <p>{{ error }}</p>
    <button class="login-error-dismiss" autofocus @click="dismissError">Try again</button>
   </div>
  </div>
 </div>
</template>

<style scoped>
.login-page { display: flex; min-height: 100vh; width: 100%; background: #070e1b; }
.login-live-toggle { position: absolute; top: 24px; right: 24px; z-index: 10; }

/* left panel */
.login-panel { flex: 0 0 clamp(380px, 32vw, 505px); display: flex; flex-direction: column; padding: 9vh 6vw 5vh; background: linear-gradient(155deg, #0b1527, #081321 70%); border-right: 1px solid var(--line); }
.login-brand { display: flex; flex-direction: column; margin-bottom: clamp(60px, 14vh, 150px); }
.login-logo { font-family: Arial, Helvetica, sans-serif; font-weight: 900; font-size: 62px; letter-spacing: -2px; line-height: 1; background: linear-gradient(125deg, #6886ff, #3262fb 70%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; width: max-content; }
.login-dot { font-size: 46px; }
.login-caption { margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; background: linear-gradient(90deg, #33d7a2, #5498ff); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.login-form { display: flex; flex-direction: column; }
.login-field { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 34px; border-bottom: 1px solid var(--line); color: var(--muted); }
.login-field input { flex: 1; min-width: 0; background: transparent; border: 0; color: #fff; font-size: 17px; }
.login-field input:focus-visible { outline: none; }
.login-field input::placeholder { color: #fff; }
.login-field input::-ms-reveal, .login-field input::-ms-clear { display: none; }
.login-password-toggle { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--muted); padding: 2px; }
.login-password-toggle:hover:not(:disabled) { color: #fff; }
.login-links { display: flex; justify-content: flex-end; margin-bottom: 34px; }
.login-forgot { color: var(--muted); font-size: 12.5px; }
.login-forgot:hover { color: #fff; }
.login-register { text-align: center; font-size: 13px; color: var(--muted); margin: 0 0 34px; }
.login-register a { color: var(--purple); font-weight: 600; margin-left: 5px; }
.login-submit { align-self: flex-start; background: #7653da; border: 1px solid #9171e7; color: #fff; font-weight: 700; font-size: 14px; padding: 14px 40px; border-radius: 8px; box-shadow: 0 8px 20px #0004; }
.login-submit:hover:not(:disabled) { background: #8962e9; }
.login-submit:disabled { opacity: 0.7; cursor: not-allowed; }

/* right hero illustration */
.login-hero { flex: 1; min-width: 0; background-repeat: no-repeat; background-position: center; background-size: cover; background-color: #0c1728; }

/* sign-in error popup */
.login-error-overlay { position: fixed; inset: 0; background: #01050bb3; backdrop-filter: blur(5px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
.login-error-modal { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; max-width: 360px; padding: 34px 30px 30px; background: linear-gradient(155deg, #0e1a2f, #0a1322); border: 1px solid #2c3a51; border-radius: 16px; box-shadow: 0 20px 60px #0008; animation: login-error-in .2s ease; }
.login-error-modal h3 { margin: 0; font-size: 18px; color: #edf0f8; }
.login-error-modal p { margin: 0; font-size: 13px; line-height: 1.7; color: #a9b4cb; }
.login-error-dismiss { margin-top: 6px; background: #7653da; border: 1px solid #9171e7; color: #fff; font-weight: 700; font-size: 13px; padding: 11px 28px; border-radius: 8px; box-shadow: 0 8px 20px #0004; }
.login-error-dismiss:hover { background: #8962e9; }
@keyframes login-error-in { from { transform: translateY(8px) scale(.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

@media (max-width: 900px) {
 .login-hero { display: none; }
 .login-panel { flex: 1; max-width: none; }
}
</style>
