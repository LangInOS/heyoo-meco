// StepFun Realtime API adapter.
//
// StepFun's Realtime API is OpenAI-compatible. The protocol uses JSON events
// over a single WebSocket:
//   - Client appends mic audio: { type: 'input_audio_buffer.append', audio: <base64-pcm16> }
//   - Server streams AI audio:   { type: 'response.audio.delta', delta: <base64-pcm16> }
//   - Server streams text:       { type: 'response.output_text.delta', delta: string }
//   - Barge-in: server fires `input_audio_buffer.speech_started` mid-response;
//     the client cancels local playback to stop the AI's audio immediately.
//
// Audio format: 24kHz mono 16-bit PCM, base64-encoded (see ../types).
// The 24kHz rate is enforced locally by the capture/playback hooks; it is
// NOT sent in `session.update` because StepFun does not document a
// `sample_rate` field there.
//
// Auth: the browser cannot set `Authorization` headers on WebSocket, so the
// URL points at the main-process voice proxy which injects the header. The
// proxy validates that the upstream hostname is in its allowlist.
//
// This adapter is intentionally stateless beyond the socket. The orchestrator
// hook (useRealtimeConversation) owns session lifecycle and audio I/O routing.

import {
  type ClientEvent,
  type RealtimeSessionConfig,
  type ServerEvent,
} from '../types'

export interface StepFunRealtimeAdapterOptions {
  /** WebSocket URL of the local proxy endpoint (provided by main process). */
  proxyUrl: string
  /** Resolved realtime session config (apiKey, model, persona, sampleRate). */
  config: RealtimeSessionConfig
  /** Called for every server event received. */
  onEvent: (event: ServerEvent) => void
  /** Called when the underlying socket transitions state. */
  onConnectionChange: (state: 'connecting' | 'open' | 'closed' | 'error') => void
}

export class StepFunRealtimeAdapter {
  private ws: WebSocket | null = null
  private readonly options: StepFunRealtimeAdapterOptions
  // Whether the opening-remark response.create has been sent. Deferred until
  // the server acknowledges the session (session.created/updated) so the
  // server doesn't drop it for arriving before the session is ready.
  private openingRemarkSent = false

  constructor(options: StepFunRealtimeAdapterOptions) {
    this.options = options
  }

  /** Open the WebSocket. The session.update is sent automatically on open. */
  connect(): void {
    if (this.ws) return
    // Reset per-session state so a reconnect re-sends the opening remark.
    this.openingRemarkSent = false
    const { proxyUrl, config } = this.options
    // StepFun Realtime API endpoint (per official docs):
    //   wss://api.stepfun.com/v1/realtime?model=<model>
    const target = `wss://api.stepfun.com/v1/realtime?model=${encodeURIComponent(config.model)}`
    const url = `${proxyUrl}?target=${encodeURIComponent(target)}&apiKey=${encodeURIComponent(config.apiKey)}`

    this.options.onConnectionChange('connecting')
    console.log('[Realtime] Connecting to:', target)
    this.ws = new WebSocket(url)
    // Server sends text frames (JSON). We never expect binary.
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      console.log('[Realtime] WebSocket connected')
      this.options.onConnectionChange('open')
      // Only send session.update here. The opening remark (response.create)
      // is deferred until the server acknowledges the session is ready
      // (session.created / session.updated). Sending response.create before
      // the session is acknowledged causes StepFun to silently drop it.
      this.sendSessionUpdate()
    }
    this.ws.onmessage = (e) => this.handleMessage(e)
    this.ws.onerror = (err) => {
      console.error('[Realtime] WebSocket error:', err)
      // Don't report error state here — onclose will fire next with the definitive
      // close code. Reporting error from onerror causes a brief flash during the
      // initial connection handshake when onerror can fire before onopen.
    }
    this.ws.onclose = (event) => {
      console.log('[Realtime] WebSocket closed, code:', event.code, 'reason:', event.reason)
      // Only report abnormal closures as errors. Normal close (1000) means the
      // session ended cleanly.
      if (event.code === 1000) {
        this.options.onConnectionChange('closed')
      } else {
        this.options.onConnectionChange('error')
      }
      this.ws = null
    }
  }

  /**
   * Configure the session once the socket is open.
   *
   * Only fields documented by StepFun are sent:
   *   https://platform.stepfun.com/docs/zh/guides/developer/realtime
   * `sample_rate` and a detailed `turn_detection` object are NOT documented
   * and were previously rejected by the server, which silently disabled
   * server VAD. With VAD left at its default (enabled), the server
   * auto-commits the user's audio and auto-creates a response after
   * `input_audio_buffer.speech_stopped` - exactly the behavior we want.
   */
  private sendSessionUpdate(): void {
    const { config } = this.options
    const sessionPayload: ClientEvent = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: config.persona.instructions,
        voice: config.persona.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        // Explicit server VAD. The docs state VAD is enabled by default, but
        // in practice the server only starts auto-committing / auto-responding
        // after this object is present. Values mirror the OpenAI-compatible
        // realtime schema that StepFun documents.
        turn_detection: {
          type: 'server_vad',
          // Lowered from 0.5 → 0.1. The renderer-side mic amplitude during
          // speech peaks around 0.05–0.10 on this machine; the previous
          // 0.5 threshold was high enough that the server VAD never fired.
          threshold: 0.1,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    }
    console.log('[Realtime] Sending session.update:', sessionPayload)
    this.send(sessionPayload)
  }

  /**
   * Trigger the opening greeting so the user hears an AI voice immediately
   * after connecting. Per StepFun's "实现开场白" guide, send a
   * `response.create` event that instructs the model to output the greeting
   * verbatim.
   *
   * Field-naming note: the doc's opening-remark example nests the payload
   * under `session`, but EVERY other `response.create` example in the same
   * doc nests under `response`. The `session` variant did not produce any
   * AI output in practice; we use the consistent `response` nesting.
   */
  private sendOpeningRemark(): void {
    const payload: ClientEvent = {
      type: 'response.create',
      response: {
        instructions: '请你原样无修改地输出下面的话：你好，我是你的AI助手。',
      },
    }
    console.log('[Realtime] Sending opening remark')
    this.send(payload)
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') {
      console.log('[Realtime] Binary frame received, size:', event.data.byteLength ?? event.data.size)
      return
    }
    let parsed: ServerEvent
    try {
      parsed = JSON.parse(event.data) as ServerEvent
    } catch {
      // Ignore malformed frames. StepFun occasionally sends keepalive pings.
      return
    }
    // Log every event with its full payload for debugging.
    console.log('[Realtime] Server event:', parsed.type, parsed)
    // Once the session is acknowledged by the server, send the opening
    // remark. We accept either session.created (initial) or session.updated
    // (config applied) as the readiness signal.
    if (
      !this.openingRemarkSent &&
      (parsed.type === 'session.created' || parsed.type === 'session.updated')
    ) {
      this.openingRemarkSent = true
      this.sendOpeningRemark()
    }
    this.options.onEvent(parsed)
  }

  /** Send raw audio bytes (PCM 16-bit) upstream as base64. */
  sendAudio(pcm: ArrayBuffer): void {
    const base64 = arrayBufferToBase64(pcm)
    console.log('[Realtime] Sending audio chunk, size:', pcm.byteLength, 'base64 length:', base64.length)
    this.send({ type: 'input_audio_buffer.append', audio: base64 })
  }

  /** Manually commit the input audio buffer (trigger response generation). */
  commitInput(): void {
    this.send({ type: 'input_audio_buffer.commit' })
  }

  /** Clear the input audio buffer (start fresh for the next turn). */
  clearInput(): void {
    this.send({ type: 'input_audio_buffer.clear' })
  }

  /** Explicitly ask the server to generate a response (required by StepFun). */
  createResponse(): void {
    this.send({ type: 'response.create' })
  }

  /** Cancel an in-progress response (server-side half of barge-in). */
  cancelResponse(): void {
    this.send({ type: 'response.cancel' })
  }

  /** Close the underlying WebSocket. Safe to call multiple times. */
  close(): void {
    if (!this.ws) return
    // Capture and detach first so connect() sees a clean slate immediately.
    // Null onclose before ws.close() so the async onclose event cannot race
    // disconnect()'s setConnectionState('closed') and flip it to 'error'.
    const ws = this.ws
    this.ws = null
    try {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
    } catch {
      // Best-effort.
    }
  }

  private send(event: ClientEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }
}

/** Convert an ArrayBuffer (PCM16) to a base64 string for the JSON event. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunk to avoid call-stack limits on very large arrays.
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return btoa(binary)
}
