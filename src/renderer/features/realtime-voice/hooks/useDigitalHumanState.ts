// Digital human state machine hook.
//
// Maps realtime session events into conversation-state transitions and
// exposes the current visual state + amplitude values to the digital human
// component. Two inputs drive state:
//   - connectionState: WS lifecycle (idle/connecting/open/closed/error)
//   - handleEvent: every server event received by the orchestrator
//
// State transition summary:
//   idle        -> connecting (on connect())
//   connecting  -> listening (on session.created)
//   listening   -> thinking  (on speech_stopped / committed / response.created)
//   thinking    -> speaking   (on response.audio.delta)
//   speaking    -> listening (on response.done)
//   any         -> error     (on error event / WS error)

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  RealtimeConversationState,
  ServerEvent,
  WsConnectionState,
} from '../types'

export interface UseDigitalHumanStateResult {
  state: RealtimeConversationState
  /** Mic amplitude (0-1). Drives mouth during 'listening'. */
  micAmplitude: number
  /** Speaker amplitude (0-1). Drives mouth during 'speaking'. */
  speakerAmplitude: number
  /** Called by audio capture hook with each new mic amplitude sample. */
  setMicAmplitude: (amp: number) => void
  /** Called by audio playback hook with each new playback amplitude sample. */
  setSpeakerAmplitude: (amp: number) => void
  /** Called by the orchestrator for every server event. */
  handleEvent: (event: ServerEvent) => void
  /** Reset to idle. Called when the conversation ends cleanly. */
  reset: () => void
}

export function useDigitalHumanState(
  connectionState: WsConnectionState,
): UseDigitalHumanStateResult {
  const [state, setState] = useState<RealtimeConversationState>('idle')
  const [micAmplitude, setMicAmplitude] = useState(0)
  const [speakerAmplitude, setSpeakerAmplitude] = useState(0)
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // React to transport lifecycle (high-level UX transitions).
  useEffect(() => {
    if (connectionState === 'connecting') {
      setState('connecting')
    } else if (connectionState === 'closed' || connectionState === 'idle') {
      setState('idle')
      setMicAmplitude(0)
      setSpeakerAmplitude(0)
    } else if (connectionState === 'error') {
      setState('error')
    }
    // 'open' is implicit - we wait for `session.created` before entering 'listening'.
  }, [connectionState])

  const handleEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        setState('listening')
        break
      case 'input_audio_buffer.speech_started':
        // Only treat as user speech if we're currently waiting for input.
        // While the bot is speaking the server may still fire speech_started
        // from the bot's own voice leaking through speakers → mic; in that
        // case we keep the 'speaking' state so the digital human doesn't
        // prematurely snap back to 'listening'.
        setState((prev) => (prev === 'thinking' ? 'listening' : prev))
        break
      case 'input_audio_buffer.speech_stopped':
      case 'input_audio_buffer.committed':
        // Only transition to thinking if the user was actually speaking.
        setState((prev) => (prev === 'listening' ? 'thinking' : prev))
        break
      case 'response.created':
        setState('thinking')
        break
      case 'response.audio.delta':
      case 'response.audio_transcript.delta':
        // The transcript usually starts streaming seconds before the first
        // audio delta (TTS generation latency). Transition to 'speaking' on
        // either so the digital human doesn't sit in 'thinking' during that gap.
        setState((prev) => (prev === 'speaking' ? prev : 'speaking'))
        // While audio is still flowing, keep the "speaking" state alive.
        if (speakingTimerRef.current) {
          clearTimeout(speakingTimerRef.current)
          speakingTimerRef.current = null
        }
        break
      case 'response.done':
        // Don't snap back to listening immediately. The server may still be
        // pushing final audio chunks after response.done, so wait a short
        // grace period before leaving 'speaking'.
        if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current)
        speakingTimerRef.current = setTimeout(() => {
          speakingTimerRef.current = null
          setState('listening')
        }, 400)
        break
      case 'error':
        setState('error')
        break
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setMicAmplitude(0)
    setSpeakerAmplitude(0)
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current)
      speakingTimerRef.current = null
    }
  }, [])

  // Cleanup pending timers on unmount.
  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current)
        speakingTimerRef.current = null
      }
    }
  }, [])

  return {
    state,
    micAmplitude,
    speakerAmplitude,
    setMicAmplitude,
    setSpeakerAmplitude,
    handleEvent,
    reset,
  }
}
