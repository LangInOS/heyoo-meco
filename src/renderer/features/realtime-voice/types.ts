// Realtime voice conversation - internal types.
//
// Two-state model:
//   - WsConnectionState: transport-level WebSocket lifecycle
//   - RealtimeConversationState: high-level UX state shown to the user
// The orchestrator maps WS + server events into conversation state.

// High-level conversation state shown to UI / digital human.
export type RealtimeConversationState =
  | 'idle'         // No active session
  | 'connecting'   // WS connecting
  | 'listening'    // Mic active, server VAD listening for user speech
  | 'thinking'     // AI processing the input
  | 'speaking'     // AI audio is playing
  | 'error'        // Fatal error
  | 'disconnected' // Session ended cleanly

// WebSocket connection state (transport-level).
export type WsConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'error'

// Preset AI personas. Maps the user-facing `persona` enum to a full
// instruction prompt + voice id. MVP ships two presets; adding more is a
// matter of extending PERSONA_PRESETS.
export interface PersonaPreset {
  id: 'default' | 'friendly'
  // System instruction injected via session.update.instructions.
  instructions: string
  // StepAudio voice id. Real names resolved server-side by StepFun.
  voice: string
}

export const PERSONA_PRESETS: Record<'default' | 'friendly', PersonaPreset> = {
  default: {
    id: 'default',
    instructions:
      'You are a helpful, concise AI assistant. Respond naturally in spoken conversation. Keep answers short unless the user asks for detail.',
    voice: 'wenrounansheng',
  },
  friendly: {
    id: 'friendly',
    instructions:
      'You are a warm, friendly AI companion. Use a casual, encouraging tone and keep responses short. React with empathy before giving information.',
    voice: 'qingchunshaonv',
  },
}

// StepFun Realtime audio format constants.
// StepFun requires 24kHz mono 16-bit PCM, base64-encoded over the WS text channel.
export const AUDIO_FORMAT = {
  sampleRate: 24000,     // 24kHz - StepFun Realtime API requirement
  channels: 1,           // mono
  bitsPerSample: 16,     // 16-bit PCM
} as const

// StepFun Realtime API model registry.
// Only the three model ids documented at
//   https://platform.stepfun.com/docs/zh/guides/developer/realtime
// are supported by the realtime WebSocket endpoint. Other ids (e.g.
// `stepaudio-2.5-realtime`) are rejected by the server and cause the
// session to fail silently.
export const REALTIME_MODELS = [
  { id: 'step-audio-2', label: 'StepAudio 2' },
  { id: 'step-audio-2-mini', label: 'StepAudio 2 Mini' },
  { id: 'step-1o-audio', label: 'Step-1o Audio' },
] as const

export const REALTIME_MODES = [
  { id: 'audio-chat', label: 'Audio Chat' },
  { id: 'voice-chat', label: 'Voice Chat' },
] as const

export type RealtimeMode = typeof REALTIME_MODES[number]['id']

// Resolved configuration for a realtime session.
// Built by the orchestrator from RealtimeConfig + the referenced AISource.
export interface RealtimeSessionConfig {
  apiKey: string
  model: string
  persona: PersonaPreset
  // I/O sample rate. Must match AUDIO_FORMAT.sampleRate for StepFun.
  sampleRate: number
}

// === StepFun Realtime WebSocket protocol event types ===
// OpenAI-compatible realtime API. Reference:
//   https://platform.stepfun.com/docs/llms.txt (Realtime API)
//
// Note: StepFun uses `response.text.delta` / `response.text.done` for text
// streaming (NOT OpenAI's `response.output_text.delta` / `response.output_text.done`).
// It also adds `response.audio_transcript.*` for user ASR and
// `response.thinking.*` for reasoning, plus content-part/output-item events.

// Events server -> client.
export type ServerEventType =
  | 'error'
  | 'session.created'
  | 'session.updated'
  | 'response.created'
  | 'response.content_part.added'
  | 'response.content_part.done'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.thinking.delta'
  | 'response.thinking.done'
  | 'response.text.delta'
  | 'response.text.done'
  | 'response.audio.delta'
  | 'response.audio.done'
  | 'response.audio_transcript.delta'
  | 'response.audio_transcript.done'
  | 'response.done'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped'
  | 'input_audio_buffer.committed'
  | 'input_audio_buffer.cleared'
  | 'conversation.item.created'
  | 'conversation.item.deleted'
  | 'conversation.item.input_audio_transcription.completed'

// Events client -> server.
export type ClientEventType =
  | 'session.update'
  | 'input_audio_buffer.append'
  | 'input_audio_buffer.commit'
  | 'input_audio_buffer.clear'
  | 'response.cancel'
  | 'conversation.item.create'
  | 'conversation.item.delete'
  | 'response.create'

// Generic envelope for server events. Callers narrow by `type` and read the
// specific fields they need.
export interface ServerEvent {
  type: ServerEventType
  event_id?: string
  // Per-event-type payload fields. Narrow via `type` switch.
  [key: string]: unknown
}

// Generic envelope for client events.
export interface ClientEvent {
  type: ClientEventType
  [key: string]: unknown
}
