import type { RouteModuleMeta } from './_meta-types'

export const MODULE: RouteModuleMeta = {
  file: 'voice',
  routes: {
    // Renderer-only plumbing for voice input: remote clients (Capacitor)
    // post recorded audio here and the server injects the real provider key,
    // which the config API masks for them. Not an agent capability.
    'POST /voice/asr/sse': { expose: 'internal' },
  },
}
