// Orchestrator hook: combines session, mic, playback, and digital human
// state into a single API consumed by <RealtimeButton /> and <RealtimeOverlay />.
//
// Responsibilities:
//   - Resolve RealtimeConfig -> RealtimeSessionConfig (lookup source apiKey + persona)
//   - Start/stop the conversation (open WS + start mic + subscribe to events)
//   - Route server events to the digital human state machine + accumulate text
//   - Route audio chunks bidirectionally (mic -> server, server -> playback)
//   - Drive barge-in: when the user starts speaking mid-response, cancel the
//     AI's playback locally. The server's `input_audio_buffer.speech_started`
//     event is the trigger.
//
// Refs are used to break circular callback dependencies: the session's onEvent
// needs to enqueue audio into playback, but playback's amplitude callback
// needs to push into the digital human. Both are stable refs, so the session
// onEvent identity is stable across renders and connect() runs once.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRealtimeSession } from './useRealtimeSession'
import { useAudioCapture } from './useAudioCapture'
import { useAudioPlayback } from './useAudioPlayback'
import { useDigitalHumanState } from './useDigitalHumanState'
import {
  PERSONA_PRESETS,
  REALTIME_MODELS,
  REALTIME_MODES,
  type RealtimeConversationState,
  type RealtimeSessionConfig,
  type ServerEvent,
} from '../types'
import type { AISource, RealtimeConfig } from '../../../types'

// Bridge renderer-side logs into the main-process file transport.
const bridgeLog = (...args: unknown[]) => {
  try {
    const w = window as unknown as { halo?: { realtimeLog?: (...a: unknown[]) => void } }
    w.halo?.realtimeLog?.(...args)
  } catch { /* best-effort */ }
}

const VAD_FALLBACK_MS = 4000

export interface UseRealtimeConversationOptions {
  /** Realtime config from settings. null = feature not configured. */
  config: RealtimeConfig | null
  /** AI source resolved by caller (provides apiKey). null = source not resolved. */
  resolvedSource: AISource | null
  /** Local proxy URL (e.g. ws://127.0.0.1:<port>/). null = main not ready. */
  proxyUrl: string | null
  /** voice-chat only: send the final user transcript through the normal chat pipeline. */
  onVoiceTranscript?: (text: string) => void
}

export interface UseRealtimeConversationResult {
  /** True while the conversation is active (connecting, listening, thinking, speaking). */
  active: boolean
  /** High-level UX state for the digital human. */
  conversationState: ReturnType<typeof useDigitalHumanState>['state']
  /** Latest mic amplitude (0-1). */
  micAmplitude: number
  /** Latest playback amplitude (0-1). */
  speakerAmplitude: number
  /** Accumulated AI text for the current response turn. Cleared on each new turn. */
  streamingText: string
  /** Start the conversation. No-op if not configured or already active. */
  start: () => Promise<void>
  /** End the conversation. Safe to call when inactive. */
  stop: () => void
  /** voice-chat only: inject a text response and trigger TTS playback. */
  speakText: (text: string) => void
}

export function useRealtimeConversation(
  options: UseRealtimeConversationOptions,
): UseRealtimeConversationResult {
  const { config, resolvedSource, proxyUrl } = options

  // Resolve session config once credentials are available.
  const sessionConfig = useMemo<RealtimeSessionConfig | null>(() => {
    if (!config || !resolvedSource?.apiKey) return null
    const persona = PERSONA_PRESETS[config.persona] ?? PERSONA_PRESETS.default
    // Fall back to the default model if the stored id is no longer in the
    // registry (e.g. configs saved with the old `stepaudio-2.5-realtime`
    // value, which StepFun's realtime endpoint rejects). Lets existing
    // users upgrade without re-opening settings.
    const knownModelIds = new Set<string>(REALTIME_MODELS.map((m) => m.id))
    const model: string = knownModelIds.has(config.realtimeModel)
      ? config.realtimeModel
      : REALTIME_MODELS[0].id
    if (model !== config.realtimeModel) {
      console.warn('[Realtime] Stored model id not in registry, falling back:', config.realtimeModel, '->', model)
    }
    return {
      apiKey: resolvedSource.apiKey,
      model,
      persona,
      sampleRate: 24000,
      mode: config.mode ?? 'audio-chat',
    }
  }, [config, resolvedSource])

  // Stable refs for components the session onEvent needs to call into.
  // The session hook is constructed *before* the digital human + playback
  // hooks below, so we use refs to defer the actual call targets.
  const digitalHumanRef = useRef<{
    handleEvent: (e: ServerEvent) => void
    setMicAmplitude: (a: number) => void
    setSpeakerAmplitude: (a: number) => void
    state: RealtimeConversationState
  } | null>(null)
  const playbackRef = useRef<{
    enqueue: (b: string) => void
    cancel: () => void
    resume: () => void
    playing: boolean
  } | null>(null)
  const sessionRef = useRef<ReturnType<typeof useRealtimeSession> | null>(null)

  const [streamingText, setStreamingText] = useState('')

  // VAD fallback timer ref. Server VAD has not reliably triggered
  // speech_started/speech_stopped in our tests, so after each AI turn we
  // arm a safety timeout only after mic activity is detected. The timer
  // is edge-triggered: it arms on the first amplitude sample that crosses
  // VOICE_EDGE_THRESHOLD after an AI turn, and fires after
  // VAD_FALLBACK_MS of sustained (or paused) speech. Quiet idle periods
  // never arm the timer, which prevents the bot from replying to silence.
  const vadFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const awaitingUserInputRef = useRef(false)
  const postResponseCooldownRef = useRef(0)
  const pendingVoiceTranscriptRef = useRef<string | null>(null)
  const ttsPlayingRef = useRef(false)
  const clearVadFallbackTimer = useCallback(() => {
    if (vadFallbackTimerRef.current) {
      clearTimeout(vadFallbackTimerRef.current)
      vadFallbackTimerRef.current = null
    }
  }, [])

  const handleEvent = useCallback((event: ServerEvent) => {
    console.log('[Realtime] handleEvent:', event.type, event)
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (event as { transcript?: string }).transcript ?? ''
        bridgeLog('[Realtime] transcript event:', 'mode=', sessionConfig?.mode, 'transcript=', transcript)
        if (transcript && sessionConfig?.mode === 'voice-chat') {
          // Ignore transcripts while TTS is playing to prevent the bot from
          // hearing its own voice and creating a feedback loop.
          if (ttsPlayingRef.current) {
            console.log('[Realtime] Ignoring transcript during TTS playback:', transcript)
            break
          }
          // Cancel any in-progress server response so it doesn't auto-reply.
          sessionRef.current?.sendCancelResponse()
          pendingVoiceTranscriptRef.current = transcript
          bridgeLog('[Realtime] Voice-chat transcript ready:', transcript)
          // Route through normal chat pipeline immediately.
          options.onVoiceTranscript?.(transcript)
          pendingVoiceTranscriptRef.current = null
        }
        break
      }
      case 'response.created':
        // New AI turn - clear the previous text.
        setStreamingText('')
        // Fallback: if the server auto-created a response before the transcript
        // arrived, cancel it now and route through normal chat.
        if (sessionConfig?.mode === 'voice-chat' && pendingVoiceTranscriptRef.current) {
          bridgeLog('[Realtime] Voice-chat response.created fallback, routing:', pendingVoiceTranscriptRef.current)
          sessionRef.current?.sendCancelResponse()
          const text = pendingVoiceTranscriptRef.current
          pendingVoiceTranscriptRef.current = null
          options.onVoiceTranscript?.(text)
        }
        break
      case 'response.done':
        // End of AI turn: clear the input buffer so the next turn starts fresh,
        // then mark that we're awaiting user input. The fallback timer is
        // amplitude-driven: it only arms when the mic signal rises above
        // VOICE_EDGE_THRESHOLD after an AI turn, and only while the bot is not
        // actively playing audio. This prevents the bot from replying to its own
        // playback leaking into the mic (the "self-chatter" bug).
        // This must run for BOTH modes so the next user turn can be captured.
        bridgeLog('[Realtime] response.done, mode=', sessionConfig?.mode)
        sessionRef.current?.sendClearInput()
        if (sessionConfig?.mode === 'voice-chat' && ttsPlayingRef.current) {
          ttsPlayingRef.current = false
          // Extended cooldown after TTS: gives speakers/mic time to settle so
          // the bot doesn't hear its own voice and loop.
          postResponseCooldownRef.current = Date.now() + 4000
        } else {
          postResponseCooldownRef.current = Date.now() + 2000
        }
        awaitingUserInputRef.current = true
        break
      case 'response.text.delta': {
        const delta = (event as { delta?: string }).delta
        if (delta) setStreamingText((prev) => prev + delta)
        break
      }
      case 'response.audio.delta': {
        const delta = (event as { delta?: string }).delta
        if (delta) playbackRef.current?.enqueue(delta)
        break
      }
      case 'input_audio_buffer.speech_started':
        // Barge-in: cancel local playback immediately so the AI's voice stops.
        playbackRef.current?.cancel()
        // Server VAD is alive — cancel the manual fallback timer and mark
        // that we're no longer awaiting user input (the server will handle it).
        clearVadFallbackTimer()
        awaitingUserInputRef.current = false
        // Real user speech detected — clear TTS flag so the upcoming transcript
        // is routed to the normal chat pipeline instead of being discarded.
        ttsPlayingRef.current = false
        break
      case 'input_audio_buffer.speech_stopped':
      case 'input_audio_buffer.committed':
        // Server VAD auto-commits and auto-creates a response when
        // turn_detection is enabled. Cancel the fallback timer.
        clearVadFallbackTimer()
        awaitingUserInputRef.current = false
        break
    }
    digitalHumanRef.current?.handleEvent(event)
  }, [sessionConfig, options])

  const session = useRealtimeSession({
    config: sessionConfig,
    proxyUrl,
    onEvent: handleEvent,
  })
  sessionRef.current = session

  // VAD fallback: after an AI turn ends, arm a 4-second commit timer only
  // when mic activity is detected. This prevents the bot from replying to
  // silence (the previous unconditional timer caused garbled/duplicate answers).
  const onMicActivity = useCallback(
    (amp: number) => {
      const VOICE_EDGE_THRESHOLD = 0.04
      if (!awaitingUserInputRef.current) return
      // Ignore mic activity while the bot is speaking. Playback audio leaking
      // into the mic is the primary cause of the "bot replying to itself"
      // failure mode.
      if (playbackRef.current?.playing) return
      // Guard against the bot hearing its own voice through the speakers.
      // After response.done we keep a short cooldown so the playback
      // hardware has time to stop and the room echo to fade before we
      // consider arming the fallback timer.
      if (Date.now() < postResponseCooldownRef.current) return
      if (amp > VOICE_EDGE_THRESHOLD && !vadFallbackTimerRef.current) {
        console.log('[Realtime] Voice activity detected (amp=', amp, ') — arming VAD fallback timer')
        vadFallbackTimerRef.current = setTimeout(() => {
          console.log('[Realtime] VAD fallback timer fired — manually committing + creating response')
          sessionRef.current?.commitInput()
          sessionRef.current?.createResponse()
          vadFallbackTimerRef.current = null
          awaitingUserInputRef.current = false
          postResponseCooldownRef.current = 0
        }, 4000)
      }
    },
    [sessionRef],
  )

  const digitalHuman = useDigitalHumanState(session.connectionState)
  digitalHumanRef.current = {
    handleEvent: digitalHuman.handleEvent,
    setMicAmplitude: digitalHuman.setMicAmplitude,
    setSpeakerAmplitude: digitalHuman.setSpeakerAmplitude,
    state: digitalHuman.state,
  }

  const capture = useAudioCapture({
    onChunk: (pcm) => session.sendAudio(pcm),
    onAmplitude: (amp) => {
      digitalHumanRef.current?.setMicAmplitude(amp)
      onMicActivity(amp)
    },
  })

  const playback = useAudioPlayback({
    onPlayingChange: () => { /* state derived from amplitude + server events */ },
    onAmplitude: (amp) => digitalHumanRef.current?.setSpeakerAmplitude(amp),
  })
  playbackRef.current = { enqueue: playback.enqueue, cancel: playback.cancel, resume: playback.resume, playing: playback.playing }

  const start = useCallback(async () => {
    if (!sessionConfig) {
      console.warn('[Realtime] Cannot start: sessionConfig is null (check source/apiKey)')
      return
    }
    if (!proxyUrl) {
      console.warn('[Realtime] Cannot start: proxyUrl is null (voice proxy not available)')
      return
    }
    console.log('[Realtime] Starting conversation, model:', sessionConfig.model, 'voice:', sessionConfig.persona.voice)
    playback.resume()
    sessionRef.current?.connect()
    await capture.start()
  }, [sessionConfig, proxyUrl, capture, playback])

  const stop = useCallback(() => {
    clearVadFallbackTimer()
    awaitingUserInputRef.current = false
    capture.stop()
    playback.cancel()
    sessionRef.current?.disconnect()
    setStreamingText('')
  }, [capture, playback, clearVadFallbackTimer])

  const active = session.connectionState !== 'idle' && session.connectionState !== 'closed'

  const speakText = useCallback((text: string) => {
    if (!text || !sessionRef.current) return
    console.log('[Realtime] speakText requesting TTS for', text.length, 'chars')
    // Clear any leftover user audio so the model doesn't re-process it.
    sessionRef.current.sendClearInput()
    ttsPlayingRef.current = true
    sessionRef.current.speakText(text)
  }, [])

  return {
    active,
    conversationState: digitalHuman.state,
    micAmplitude: digitalHuman.micAmplitude,
    speakerAmplitude: digitalHuman.speakerAmplitude,
    streamingText,
    start,
    stop,
    speakText,
  }
}
