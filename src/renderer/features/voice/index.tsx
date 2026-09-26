/**
 * Voice feature module
 *
 * Bundles STT backend adapters, a React hook for recording, and the settings
 * panel used inside AdvancedSection. Everything voice-related lives here so
 * the host components (AdvancedSection, InputArea) only need a thin mount point.
 *
 * Design: voice credentials are NOT configured separately. The user picks an
 * existing AISource (e.g. aliyun) and we reuse its apiKey. Only the
 * STT model choice is voice-specific.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Mic, ChevronDown, ChevronUp, AlertCircle, Keyboard } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useAppStore } from '../../stores/app.store'
import type { VoiceConfig } from '../../types'
import type { AISourcesConfig } from '../../types'
import { isCapacitor, getRemoteServerUrl, getAuthToken } from '../../api/transport'
import { matchesShortcut, formatShortcut, describeShortcut } from '../../utils/keyboard-shortcut'
import { useNotificationStore } from '../../stores/notification.store'
import { playMicFeedback } from './sound'

// ── Voice-capable provider registry ────────────────────────────────────
//
// Maps a BuiltinProviderId to its STT WebSocket endpoint and available models.
// The provider id comes from the selected AISource.provider; the apiKey comes
// from AISource.apiKey. No new credentials are stored in VoiceConfig.

interface VoiceCapableProvider {
  wsUrl: string             // WebSocket endpoint (real-time streaming)
  sseUrl?: string           // HTTP+SSE endpoint (record-then-transcribe)
  sttModels: string[]       // Models for WebSocket transport
  sseModels?: string[]      // Models for SSE transport (may differ)
  defaultSttModel: string
  defaultSseModel?: string
}

const VOICE_CAPABLE_PROVIDERS: Record<string, VoiceCapableProvider> = {
  aliyun: {
    wsUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',
    sttModels: ['paraformer-realtime-v2', 'paraformer-realtime-v1'],
    defaultSttModel: 'paraformer-realtime-v2',
  },
  stepfun: {
    // WebSocket (API billing, 1.2 元/h) - real-time bidirectional streaming
    wsUrl: 'wss://api.stepfun.com/v1/realtime/asr/stream',
    sttModels: ['stepaudio-2.5-asr-stream'],
    defaultSttModel: 'stepaudio-2.5-asr-stream',
    // SSE (Step Plan subscription) - record-then-transcribe, quasi-real-time
    sseUrl: 'https://api.stepfun.com/step_plan/v1/audio/asr/sse',
    sseModels: ['stepaudio-2.5-asr'],
    defaultSseModel: 'stepaudio-2.5-asr',
  },
}

export function isVoiceCapableProvider(provider: string): boolean {
  return provider in VOICE_CAPABLE_PROVIDERS
}

// Platform-specific default shortcut key. macOS uses Cmd+Space (close to
// the system dictation habit, but conflicts with Spotlight - warn the user).
// Windows/Linux get a Ctrl/Super+Alt+V combo that is unlikely to conflict.
export function getDefaultShortcutKey(): string {
  const platform = typeof window !== 'undefined' ? window.platform : null
  if (platform?.isMac) return 'Cmd+Space'
  if (platform?.isWindows) return 'Ctrl+Alt+V'
  if (platform?.isLinux) return 'Super+Alt+V'
  return 'Cmd+Space'
}

export function createDefaultVoiceConfig(): VoiceConfig {
  return {
    sourceId: null,
    sttModel: '',
    shortcutKey: getDefaultShortcutKey(),
    shortcutMode: 'hold',
    transport: 'sse',
  }
}

// ── STT session contract ────────────────────────────────────────────────

export type STTState = 'idle' | 'recording' | 'transcribing' | 'error'

interface STTSession {
  stop: () => Promise<void>
}

interface STTCallbacks {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
}

// ── DashScope STT adapter ───────────────────────────────────────────────
//
// DashScope realtime ASR uses a duplex WebSocket at /api-ws/v1/inference.
// Protocol: run-task -> continue-task (audio chunks) -> finish-task.
// Auth: WebSocket subprotocol ["bearer", apiKey].
// Audio: 16kHz mono PCM, base64-encoded inside JSON messages.

function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

async function startDashScopeSTT(
  wsUrl: string,
  apiKey: string,
  sttModel: string,
  callbacks: STTCallbacks
): Promise<STTSession> {
  const taskId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  // getUserMedia must run after a user gesture; the caller (useVoiceSTT.start)
  // is invoked from a click handler so this is safe.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })

  const audioContext = new AudioContext({ sampleRate: 16000 })
  // Autoplay policy: Electron/Chromium may start AudioContext in suspended
  // state even after a user gesture. Resume explicitly so the processor fires.
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  const source = audioContext.createMediaStreamSource(stream)
  // ScriptProcessorNode is deprecated but the simplest path that works in
  // both Electron and mobile browsers. Swap to AudioWorkletNode later.
  const processor = audioContext.createScriptProcessor(4096, 1, 1)

  let ws: WebSocket | null = null
  let stopped = false

  const sendJson = (obj: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  const sendTaskStart = () => {
    sendJson({
      header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model: sttModel,
        parameters: { format: 'pcm', sample_rate: 16000 },
        input: {},
      },
    })
  }

  const sendAudioChunk = (pcm: Int16Array) => {
    sendJson({
      header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
      payload: { input: { audio: pcm16ToBase64(pcm) } },
    })
  }

  const sendFinish = () => {
    sendJson({
      header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
    })
  }

  const cleanup = async () => {
    stopped = true
    try {
      processor.disconnect()
      source.disconnect()
    } catch {}
    stream.getTracks().forEach(t => t.stop())
    if (audioContext.state !== 'closed') {
      try { await audioContext.close() } catch {}
    }
    if (ws) {
      sendFinish()
      try { ws.close() } catch {}
      ws = null
    }
  }

  ws = new WebSocket(wsUrl, ['bearer', apiKey])

  ws.onopen = () => {
    sendTaskStart()
    processor.onaudioprocess = (e) => {
      if (stopped) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      sendAudioChunk(pcm)
    }
    source.connect(processor)
    processor.connect(audioContext.destination)
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      // DashScope may send error responses without a sentence field.
      const header = msg?.header
      if (header && header.code && header.code >= 400) {
        callbacks.onError(header.message || `DashScope error: ${header.code}`)
        cleanup()
        return
      }
      const sentence = msg?.payload?.output?.sentence
      if (!sentence) return
      const text: string = sentence.text ?? ''
      if (text && sentence.is_end) {
        callbacks.onFinal(text)
      }
    } catch (err) {
      console.error('[voice-stt] Failed to parse message:', err)
    }
  }

  ws.onerror = () => {
    callbacks.onError('WebSocket connection failed. Check the AI Source API key.')
    cleanup()
  }

  ws.onclose = (event) => {
    if (!stopped && event.code !== 1000) {
      callbacks.onError(`WebSocket closed (code ${event.code}). Check the AI Source API key and model permissions.`)
    }
  }

  return {
    stop: async () => {
      await cleanup()
    },
  }
}

// ── StepFun STT adapter (WebSocket streaming) ────────────────────────────
//
// Protocol: wss://api.stepfun.com/v1/realtime/asr/stream
// Model: stepaudio-2.5-asr-stream
// Auth: Authorization: Bearer <apiKey> header (injected by the main-process
//   voice proxy; browser WebSocket cannot set custom headers itself).
// Client messages:
//   session.update → configure STT model, language, VAD
//   input_audio_buffer.append → send 16kHz mono PCM (base64) chunks
// Server messages:
//   conversation.item.input_audio_transcription.delta → cumulative partial text
//   conversation.item.input_audio_transcription.completed → final transcript
// Server VAD (silence_duration_ms: 800) auto-detects turn end.

async function startStepFunSTT(
  wsUrl: string,
  sttModel: string,
  callbacks: STTCallbacks
): Promise<STTSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })

  const audioContext = new AudioContext({ sampleRate: 16000 })
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)

  let ws: WebSocket | null = null
  let stopped = false
  let eventIdSeq = 0
  // StepFun sends `text` as incremental fragments, not cumulative (despite
  // the docs claiming otherwise). Accumulate here so the hook receives a
  // growing cumulative string it can display by replacement.
  let accumulatedText = ''

  const nextEventId = () => `event_${Date.now()}_${eventIdSeq++}`

  const sendJson = (obj: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  const cleanup = async () => {
    stopped = true
    try {
      processor.disconnect()
      source.disconnect()
    } catch {}
    stream.getTracks().forEach(t => t.stop())
    if (audioContext.state !== 'closed') {
      try { await audioContext.close() } catch {}
    }
    // Flush accumulated text before closing the session so manual stop
    // doesn't discard the transcript built up via onPartial.
    if (accumulatedText) {
      callbacks.onFinal(accumulatedText)
      accumulatedText = ''
    }
    if (ws) {
      try { ws.close(1000) } catch {}
      ws = null
    }
  }

  console.log('[voice-stt] StepFun WebSocket URL:', wsUrl)
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    console.log('[voice-stt] StepFun WebSocket connected')
    // StepFun's session.update nests config under session.audio.input.*,
    // unlike OpenAI's flat realtime-api layout. Mismatched structure here
    // causes the server to silently drop all subsequent audio.
    sendJson({
      event_id: nextEventId(),
      type: 'session.update',
      session: {
        audio: {
          input: {
            format: {
              type: 'pcm',
              codec: 'pcm_s16le',
              rate: 16000,
              bits: 16,
              channel: 1,
            },
            transcription: {
              model: sttModel,
              language: 'zh',
              enable_itn: true,
              full_rerun_on_commit: true,
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              silence_duration_ms: 800,
            },
          },
        },
      },
    })

    processor.onaudioprocess = (e) => {
      if (stopped) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      sendJson({
        event_id: nextEventId(),
        type: 'input_audio_buffer.append',
        audio: pcm16ToBase64(pcm),
      })
    }
    source.connect(processor)
    processor.connect(audioContext.destination)
  }

  ws.onmessage = async (event) => {
    try {
      // Browser delivers text frames as string, binary frames as Blob.
      // The proxy preserves frame type, but be defensive: if a binary frame
      // slips through, decode the Blob before parsing.
      const rawText = typeof event.data === 'string'
        ? event.data
        : await (event.data as Blob).text()
      const msg = JSON.parse(rawText)
      const type = msg?.type as string | undefined

      if (type === 'error') {
        const err = msg.error as { message?: string; code?: string; type?: string } | undefined
        const message = err?.message
          ? `${err.message}${err.code ? ` (code: ${err.code})` : ''}`
          : 'Unknown StepFun ASR error'
        console.error('[voice-stt] StepFun error event:', msg)
        callbacks.onError(message)
        cleanup()
        return
      }

      if (type === 'conversation.item.input_audio_transcription.delta') {
        const text = msg.text as string | undefined
        if (text !== undefined) {
          accumulatedText += text
          callbacks.onPartial(accumulatedText)
        }
        return
      }

      if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = msg.transcript as string | undefined
        // Reset for the next utterance (server_vad splits on silence).
        accumulatedText = ''
        if (transcript) {
          callbacks.onFinal(transcript)
        }
        return
      }
    } catch (err) {
      console.error('[voice-stt] Failed to parse message:', err)
    }
  }

  ws.onerror = (event) => {
    console.error('[voice-stt] StepFun WebSocket error event:', event)
    callbacks.onError('WebSocket connection failed. Check the AI Source API key.')
    cleanup()
  }

  ws.onclose = (event) => {
    console.error('[voice-stt] StepFun WebSocket closed:', event.code, event.reason)
    if (!stopped && event.code !== 1000) {
      callbacks.onError(`WebSocket closed (code ${event.code}). Check the AI Source API key and model permissions.`)
    }
  }

  return {
    stop: async () => {
      await cleanup()
    },
  }
}

// ── StepFun SSE adapter (record-then-transcribe) ────────────────────────
//
// Protocol: POST https://api.stepfun.com/step_plan/v1/audio/asr/sse
// Model: stepaudio-2.5-asr (NOT the -stream variant)
// Auth: Authorization: Bearer <apiKey> (fetch can set headers, no proxy needed)
// Flow: record audio locally -> on stop, Base64-encode -> POST -> SSE delta
// events stream the transcription back.
// Unlike the WebSocket adapter, no text appears during recording - the
// transcription only starts after the user stops and the full audio is sent.

async function startStepFunSSE(
  sseUrl: string,
  apiKey: string,
  sttModel: string,
  callbacks: STTCallbacks
): Promise<STTSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })

  const audioContext = new AudioContext({ sampleRate: 16000 })
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)

  let stopped = false
  const audioChunks: Int16Array[] = []

  processor.onaudioprocess = (e) => {
    if (stopped) return
    const input = e.inputBuffer.getChannelData(0)
    const pcm = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    audioChunks.push(pcm)
  }
  source.connect(processor)
  processor.connect(audioContext.destination)

  const cleanupRecording = async () => {
    stopped = true
    try {
      processor.disconnect()
      source.disconnect()
    } catch {}
    stream.getTracks().forEach(t => t.stop())
    if (audioContext.state !== 'closed') {
      try { await audioContext.close() } catch {}
    }
  }

  return {
    stop: async () => {
      // 1. Stop recording and release the mic
      await cleanupRecording()

      // 2. Merge buffered PCM chunks into one Int16Array
      const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0)
      if (totalLength === 0) {
        callbacks.onError('No audio recorded.')
        return
      }
      const merged = new Int16Array(totalLength)
      let offset = 0
      for (const chunk of audioChunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      // 3. POST the complete audio to the SSE endpoint
      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          audio: {
            data: pcm16ToBase64(merged),
            input: {
              transcription: {
                model: sttModel,
                language: 'zh',
                enable_itn: true,
              },
              format: {
                type: 'pcm',
                codec: 'pcm_s16le',
                rate: 16000,
                bits: 16,
                channel: 1,
              },
            },
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        callbacks.onError(
          `SSE request failed: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`
        )
        return
      }

      // 4. Parse the SSE event stream
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by a blank line.
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const eventStr of events) {
          // Each event may have multiple lines; we only care about "data: ..."
          const dataLine = eventStr
            .split('\n')
            .find(l => l.startsWith('data:'))
          if (!dataLine) continue
          const data = dataLine.slice(5).trim()
          if (!data || data === '[DONE]') continue

          try {
            const msg = JSON.parse(data)
            if (msg.type === 'transcript.text.delta') {
              accumulatedText += msg.delta ?? ''
              callbacks.onPartial(accumulatedText)
            } else if (msg.type === 'transcript.text.done') {
              const finalText = (msg.text as string | undefined) || accumulatedText
              callbacks.onFinal(finalText)
            } else if (msg.type === 'error') {
              callbacks.onError(msg.message || 'Unknown SSE ASR error')
            }
          } catch (err) {
            console.error('[voice-stt] Failed to parse SSE message:', err)
          }
        }
      }
    },
  }
}

// ── useVoiceSTT hook ────────────────────────────────────────────────────

export function useVoiceSTT(
  onTranscript: (text: string) => void,
  onPartial?: (text: string) => void
) {
  const voiceConfig = useAppStore(state => state.config?.voice)
  const aiSources = useAppStore(state => state.config?.aiSources)
  const [state, setState] = useState<STTState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [partialText, setPartialText] = useState('')
  const sessionRef = useRef<STTSession | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onPartialRef = useRef(onPartial)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onPartialRef.current = onPartial
  }, [onTranscript, onPartial])

  // Surface STT failures as an in-app toast: micError is otherwise only
  // reachable via the mic button's hover title, which does not exist on
  // mobile — failures there look like "no reaction".
  useEffect(() => {
    if (state !== 'error' || !error) return
    useNotificationStore.getState().show({
      title: 'Voice input failed',
      body: error,
      variant: 'error',
      duration: 8000,
    })
  }, [state, error])

  // Resolve the selected AISource and its voice provider metadata
  const resolved = useMemo(() => {
    if (!voiceConfig?.sourceId || !aiSources) return null
    const source = aiSources.sources.find(s => s.id === voiceConfig.sourceId)
    if (!source?.apiKey) return null
    const providerMeta = VOICE_CAPABLE_PROVIDERS[source.provider]
    if (!providerMeta) return null
    return { source, providerMeta }
  }, [voiceConfig?.sourceId, aiSources])

  const start = useCallback(async () => {
    // Clean up any previous session (including ones that failed after start()
    // returned, where sessionRef.current was set but the adapter later errored).
    if (sessionRef.current) {
      try { await sessionRef.current.stop() } catch {}
      sessionRef.current = null
    }
    if (!resolved) {
      setError('Please configure a voice-capable AI source in Advanced settings.')
      setState('error')
      return
    }
    const { source, providerMeta } = resolved
    const sttModel = voiceConfig?.sttModel || providerMeta.defaultSttModel

    setError(null)
    setState('recording')
    playMicFeedback('start')

    try {
      let session: STTSession
      if (source.provider === 'aliyun') {
        session = await startDashScopeSTT(
          providerMeta.wsUrl,
          source.apiKey!,
          sttModel,
          {
            onPartial: (text) => {
              if (onPartialRef.current) onPartialRef.current(text)
              setPartialText(text)
            },
            onFinal: (text) => {
              setPartialText('')
              onTranscriptRef.current(text)
            },
            onError: (msg) => {
              setError(msg)
              setState('error')
              sessionRef.current = null
            },
          }
        )
      } else if (source.provider === 'stepfun') {
        const isSSE = voiceConfig?.transport === 'sse' && providerMeta.sseUrl
        if (isSSE) {
          // Remote clients get a masked apiKey ('***') from the config API,
          // so they must not call StepFun directly. Route through the server,
          // which resolves the real key for sourceId and streams the SSE
          // response back verbatim — the adapter's parsing is unchanged.
          let endpoint = providerMeta.sseUrl
          if (isCapacitor()) {
            const serverUrl = getRemoteServerUrl()
            if (!serverUrl) {
              throw new Error('Server URL not configured.')
            }
            const token = getAuthToken()
            if (!token) {
              throw new Error('Not authenticated.')
            }
            endpoint = `${serverUrl}/voice/asr/sse?target=${encodeURIComponent(providerMeta.sseUrl)}&sourceId=${encodeURIComponent(source.id)}&token=${encodeURIComponent(token)}`
          }
          session = await startStepFunSSE(
            endpoint,
            source.apiKey!,
            voiceConfig.sttModel || providerMeta.defaultSseModel!,
            {
              onPartial: (text) => {
                if (onPartialRef.current) onPartialRef.current(text)
                setPartialText(text)
              },
              onFinal: (text) => {
                setPartialText('')
                setState('idle')
                onTranscriptRef.current(text)
              },
              onError: (msg) => {
                setError(msg)
                setState('error')
                sessionRef.current = null
              },
            }
          )
        } else {
          let proxyUrl: string
          if (isCapacitor()) {
            const serverUrl = getRemoteServerUrl()
            if (!serverUrl) {
              throw new Error('Server URL not configured.')
            }
            const token = getAuthToken()
            if (!token) {
              throw new Error('Not authenticated.')
            }
            // sourceId lets the server resolve the real key from its own
            // config — remote config responses mask apiKey as '***'.
            proxyUrl = `${serverUrl.replace(/^http/, 'ws')}/voice/asr?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}&sourceId=${encodeURIComponent(source.id)}&token=${encodeURIComponent(token)}`
          } else {
            const portResp = await window.halo.voiceGetProxyPort()
            if (!portResp.success) {
              throw new Error(portResp.error || 'Voice proxy is not available.')
            }
            proxyUrl = `ws://127.0.0.1:${(portResp.data as { port: number }).port}/?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}`
          }
          session = await startStepFunSTT(
            proxyUrl,
            sttModel,
            {
              onPartial: (text) => {
                if (onPartialRef.current) onPartialRef.current(text)
                setPartialText(text)
              },
              onFinal: (text) => {
                setPartialText('')
                onTranscriptRef.current(text)
              },
              onError: (msg) => {
                setError(msg)
                setState('error')
                sessionRef.current = null
              },
            }
          )
        }
      } else {
        throw new Error(
          `STT for provider "${source.provider}" is not yet supported.`
        )
      }
      sessionRef.current = session
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : err instanceof Error
            ? err.message
            : String(err)
      setError(msg)
      setState('error')
    }
  }, [resolved, voiceConfig?.sttModel, voiceConfig?.transport])

  const stop = useCallback(async () => {
    if (sessionRef.current) {
      const isSSE = voiceConfig?.transport === 'sse'
      if (isSSE) {
        setState('transcribing')
      }
      playMicFeedback('stop')
      await sessionRef.current.stop()
      sessionRef.current = null
      if (!isSSE) {
        setPartialText('')
        setState('idle')
      }
    }
  }, [voiceConfig?.transport])

  // Keep a ref of the current state so the keyboard handler can read it
  // synchronously without re-binding on every state change.
  const stateRef = useRef<STTState>(state)
  useEffect(() => { stateRef.current = state }, [state])

  const shortcutKey = voiceConfig?.shortcutKey ?? getDefaultShortcutKey()
  const shortcutMode = voiceConfig?.shortcutMode ?? 'hold'

  // Keyboard shortcut: hold-to-talk or toggle. Only active when a voice
  // source is configured; otherwise the key press is a no-op.
  useEffect(() => {
    if (!shortcutKey || !resolved) return

    let isHolding = false
    const startRef = start
    const stopRef = stop

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (!matchesShortcut(e, shortcutKey)) return
      // Prevent the key from also inserting text / triggering browser shortcuts.
      e.preventDefault()

      if (shortcutMode === 'hold') {
        if (!isHolding) {
          isHolding = true
          void startRef()
        }
      } else {
        // toggle
        if (stateRef.current === 'recording') {
          void stopRef()
        } else {
          void startRef()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (shortcutMode !== 'hold' || !isHolding) return
      if (!matchesShortcut(e, shortcutKey)) return
      e.preventDefault()
      isHolding = false
      void stopRef()
    }

    // If the window loses focus while holding, stop recording - otherwise
    // the keyup may never fire and recording would run forever.
    const handleBlur = () => {
      if (shortcutMode === 'hold' && isHolding) {
        isHolding = false
        void stopRef()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [shortcutKey, shortcutMode, resolved, start, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
    }
  }, [])

  return { state, error, partialText, start, stop, enabled: !!resolved }
}

// ── VoicePanel component (rendered inside AdvancedSection) ──────────────

interface VoicePanelProps {
  voice: VoiceConfig | undefined
  onChange: (voice: VoiceConfig) => void
}

export function VoicePanel({ voice, onChange }: VoicePanelProps) {
  const { t } = useTranslation()
  const aiSources = useAppStore(state => state.config?.aiSources)
  const [open, setOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  // Voice-capable sources from the existing aiSources list
  const voiceCapableSources = useMemo(() => {
    if (!aiSources) return []
    return aiSources.sources.filter(
      s => isVoiceCapableProvider(s.provider) && !!s.apiKey
    )
  }, [aiSources])

  // Merge saved config with defaults so old configs (created before the
  // shortcut feature) still display and use the platform default.
  const defaults = createDefaultVoiceConfig()
  const current: VoiceConfig = {
    sourceId: voice?.sourceId ?? defaults.sourceId,
    sttModel: voice?.sttModel ?? defaults.sttModel,
    shortcutKey: voice?.shortcutKey ?? defaults.shortcutKey,
    shortcutMode: voice?.shortcutMode ?? defaults.shortcutMode,
    transport: voice?.transport ?? defaults.transport,
  }
  const selectedSource = voiceCapableSources.find(s => s.id === current.sourceId)
  const providerMeta = selectedSource
    ? VOICE_CAPABLE_PROVIDERS[selectedSource.provider]
    : null

  const isMac = typeof window !== 'undefined' && window.platform?.isMac

  const handleSourceChange = (sourceId: string) => {
    const source = voiceCapableSources.find(s => s.id === sourceId)
    const meta = source ? VOICE_CAPABLE_PROVIDERS[source.provider] : null
    const transport = meta?.sseUrl ? defaults.transport : 'websocket'
    onChange({
      ...current,
      sourceId,
      transport,
      sttModel: transport === 'sse'
        ? (meta?.defaultSseModel ?? current.sttModel)
        : (meta?.defaultSttModel ?? current.sttModel),
    })
  }

  const handleTransportChange = (transport: 'websocket' | 'sse') => {
    const source = voiceCapableSources.find(s => s.id === current.sourceId)
    const meta = source ? VOICE_CAPABLE_PROVIDERS[source.provider] : null
    onChange({
      ...current,
      transport,
      sttModel: transport === 'sse'
        ? (meta?.defaultSseModel ?? current.sttModel)
        : (meta?.defaultSttModel ?? current.sttModel),
    })
  }

  const handleSttModelChange = (sttModel: string) => {
    onChange({ ...current, sttModel })
  }

  const handleShortcutModeChange = (mode: 'hold' | 'toggle') => {
    onChange({ ...current, shortcutMode: mode })
  }

  // Capture the next key press as the shortcut. Esc cancels.
  useEffect(() => {
    if (!isCapturing) return
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setIsCapturing(false)
        return
      }
      const formatted = formatShortcut(e)
      if (formatted) {
        onChange({ ...current, shortcutKey: formatted })
        setIsCapturing(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isCapturing, current, onChange])

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Mic className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t('Voice Input')}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {voiceCapableSources.length === 0 ? (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
              <span>
                {t('No voice-capable AI source found. Add a compatible AI source first.')}
              </span>
            </div>
          ) : (
            <>
              {/* AI Source selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('AI Source')}
                </label>
                <select
                  value={current.sourceId ?? ''}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{t('Select...')}</option>
                  {voiceCapableSources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.provider}
                    </option>
                  ))}
                </select>
              </div>

              {/* STT Model - only shown when a source is selected */}
              {selectedSource && providerMeta && (
                <>
                  {/* Transport mode selector - only for providers that support both WS and SSE */}
                  {providerMeta.sseUrl && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        {t('Transcription Mode')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleTransportChange('sse')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            current.transport === 'sse'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                          }`}
                        >
                          {t('Record & Transcribe')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransportChange('websocket')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            current.transport === 'websocket'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                          }`}
                        >
                          {t('Real-time')}
                        </button>
                      </div>
                      {current.transport === 'sse' && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t('Records audio first, then transcribes after you stop. Uses Step Plan subscription.')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* STT Model - show models matching the selected transport */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {t('Speech-to-Text Model')}
                    </label>
                    <select
                      value={current.sttModel || (current.transport === 'sse' ? providerMeta.defaultSseModel : providerMeta.defaultSttModel)}
                      onChange={(e) => handleSttModelChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {(current.transport === 'sse' && providerMeta.sseModels
                        ? providerMeta.sseModels
                        : providerMeta.sttModels
                      ).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Shortcut key capture */}
              {selectedSource && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t('Shortcut Key')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 text-sm bg-input border border-border rounded-lg">
                      <Keyboard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {isCapturing ? (
                        <span className="text-muted-foreground italic">
                          {t('Press a key... (Esc to cancel)')}
                        </span>
                      ) : (
                        <span className="text-foreground font-mono">
                          {describeShortcut(current.shortcutKey || '') || t('Not set')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCapturing(c => !c)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        isCapturing
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {isCapturing ? t('Cancel') : t('Capture')}
                    </button>
                  </div>
                  {isMac && current.shortcutKey === 'Cmd+Space' && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t('Cmd+Space is the macOS Spotlight shortcut. If it does not work, change Spotlight to a different key in System Settings > Keyboard > Keyboard Shortcuts > Spotlight, or capture a different key here.')}
                    </p>
                  )}
                </div>
              )}

              {/* Shortcut mode (hold/toggle) - only when a shortcut is set */}
              {selectedSource && current.shortcutKey && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t('Trigger Mode')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleShortcutModeChange('hold')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        (current.shortcutMode ?? 'hold') === 'hold'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {t('Hold to Talk')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortcutModeChange('toggle')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        current.shortcutMode === 'toggle'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {t('Toggle')}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {(current.shortcutMode ?? 'hold') === 'hold'
                      ? t('Press and hold to record; release to stop.')
                      : t('Press once to start, press again to stop.')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
