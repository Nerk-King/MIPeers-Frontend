import { defineConfig } from 'vite'
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

export default defineConfig({
 plugins: [vue()],
 server: { proxy: ilsProxy },
 preview: { proxy: ilsProxy },
})
