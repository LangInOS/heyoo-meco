/**
 * Provider feature capabilities
 *
 * Maps provider IDs to the features they support.
 * Kept separate from BuiltinProvider so feature support can evolve independently
 * of the LLM provider catalog.
 */

export interface ProviderCapabilities {
  /** Supports speech-to-text (voice input) */
  voice?: boolean
  /** Supports text-to-speech */
  tts?: boolean
}

/**
 * Providers that support voice/TTS features.
 *
 * A provider must have a corresponding entry in the voice/TTS backend
 * configuration (e.g. VOICE_CAPABLE_PROVIDERS in features/voice) for the
 * feature to actually work. This map only drives the UI indicator.
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  stepfun: {
    voice: true,
    tts: true,
  },
  aliyun: {
    voice: true,
    tts: true,
  },
}
