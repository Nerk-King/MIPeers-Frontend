import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

// The ils.mip.co.za sandbox only allows a specific origin via CORS, which a browser dev server
// rarely matches. Proxying /ils-api through Vite's own server means the real cross-origin call
// happens server-to-server (no browser CORS enforcement), so the real response — including
// business-logic error bodies like rqErrorMessage — actually reaches the app instead of being
// blocked as a "Failed to fetch".
const ilsProxy = {
 '/ils-api': {
  target: 'https://mn2503.ils.mip.co.za',
  changeOrigin: true,
  // The sandbox serves a self-signed/internal cert; Node's default TLS verification rejects it,
  // which previously made every proxied call fail before it even reached the real server. This is
  // a local-dev-only trust relaxation — a real deployment should go through a trusted cert instead.
  secure: false,
  rewrite: (path: string) => path.replace(/^\/ils-api/, ''),
 },
}

// Knowledge-base file downloads (Progress Agentic RAG) reject anonymous requests. /rag-api forwards
// them server-side with the service-account key attached, so the key comes from a non-VITE env var
// and never ends up in the browser bundle. Like /ils-api, a real deployment needs an equivalent
// server-side proxy.
function ragProxy(env: Record<string, string>): Record<string, ProxyOptions> {
 if (!env.RAG_API_ORIGIN) return {}
 return {
  '/rag-api': {
   target: env.RAG_API_ORIGIN,
   changeOrigin: true,
   rewrite: (path: string) => path.replace(/^\/rag-api/, ''),
   headers: { 'X-NUCLIA-SERVICEACCOUNT': `Bearer ${env.RAG_API_KEY ?? ''}` },
  },
 }
}

export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, '.', '')
 const proxy = { ...ilsProxy, ...ragProxy(env) }
 return {
  plugins: [vue()],
  server: { proxy },
  preview: { proxy },
 }
})
