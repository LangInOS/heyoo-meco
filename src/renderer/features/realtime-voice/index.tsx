// Realtime voice conversation feature.
//
// End-to-end voice model using StepFun's Realtime API. Provides a "speak
// button" replacing the regular send button when no text is in the input,
// and a digital human overlay that visualizes the conversation state.
//
// Public surface:
//   - <RealtimeButton />  Speak/End button mounted in InputArea
//   - <RealtimeOverlay /> Mounts <DigitalHuman /> above the input box
//   - <RealtimePanel />   Settings panel for the Advanced section
//   - useRealtimeConversation()  Orchestrator hook (used by RealtimeButton)
//
// See `docs/plans/realtime-voice.md` (if present) for the design doc.

export { RealtimeButton } from './components/RealtimeButton'
export { RealtimeOverlay } from './components/RealtimeOverlay'
export { RealtimePanel } from './components/RealtimePanel'
export { useRealtimeConversation } from './hooks/useRealtimeConversation'
export { REALTIME_MODELS, PERSONA_PRESETS } from './types'
export type { RealtimeConfig } from '../../types'
export type { RealtimeConversationState } from './types'
