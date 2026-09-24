<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock } from 'lucide-vue-next'
import heroImage from './Mipeers logo.jpg'
import { signIn } from './services/auth'
const router = useRouter()
const username = ref('')
const password = ref('')
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
</script>

<template>
 <div class="login-page">
  <section class="login-panel">
   <div class="login-brand">
    <span class="login-logo">MiP<span class="login-dot">.</span></span>
    <span class="login-caption">HUMAN SOFTWARE COMPANY</span>
   </div>
   <form class="login-form" @submit.prevent="submit" novalidate>
    <label class="login-field"><Mail :size="18" /><input v-model="username" type="text" placeholder="Username" autocomplete="username" aria-label="Username" :disabled="pending" /></label>
    <label class="login-field"><Lock :size="18" /><input v-model="password" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password" :disabled="pending" /></label>
    <p v-if="error" class="login-error" role="alert">{{ error }}</p>
    <div class="login-links"><a href="#" class="login-forgot" @click.prevent>Forgot your password?</a></div>
    <p class="login-register"><span>Don't have an account?</span> <a href="#" @click.prevent>Register</a></p>
    <button type="submit" class="login-submit" :disabled="pending">{{ pending ? 'Signing in…' : 'Login' }}</button>
   </form>
  </section>

  <section class="login-hero" :style="{ backgroundImage: `url(${heroImage})` }" role="img" aria-label="MIPeers, your everyday work assistant"></section>
 </div>
</template>

<style scoped>
.login-page { display: flex; min-height: 100vh; width: 100%; background: #070e1b; }

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
.login-error { color: #f3a1ae; font-size: 12px; margin: -18px 0 20px; }
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

@media (max-width: 900px) {
 .login-hero { display: none; }
 .login-panel { flex: 1; max-width: none; }
}
</style>
