/**
 * Combines an optional caller-provided AbortSignal with an internal timeout, so a hung request
 * (e.g. a dropped connection through the dev proxy, or a backend that never replies) always
 * surfaces as a clear error instead of leaving the UI stuck pending forever.
 */
export function withTimeout(externalSignal: AbortSignal | undefined, ms: number) {
 const controller = new AbortController()
 let timedOut = false
 const timer = setTimeout(() => { timedOut = true; controller.abort() }, ms)
 const onExternalAbort = () => controller.abort()
 externalSignal?.addEventListener('abort', onExternalAbort)
 return {
  signal: controller.signal,
  didTimeOut: () => timedOut,
  cleanup() { clearTimeout(timer); externalSignal?.removeEventListener('abort', onExternalAbort) },
 }
}
