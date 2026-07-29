// Microphone capture hook.
//
// Acquires a MediaStream at 24kHz mono and emits 16-bit PCM chunks suitable
// for StepFun Realtime API. Also runs an amplitude analyzer that the caller
// uses to drive the digital human's mouth during 'listening'.
//
// Audio graph:  MediaStream -> Source -> ScriptProcessor -> destination
//                       \-> Analyser (read-only tap for amplitude)
//
// ScriptProcessor is deprecated but universally supported and sufficient
// for MVP. A future iteration can migrate to AudioWorklet.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_FORMAT } from '../types'

// Bridge renderer-side [Realtime] logs into the main-process file transport
// so a single main.log captures the full realtime session.
const bridgeLog = (...args: unknown[]) => {
  try {
    const w = window as unknown as { halo?: { realtimeLog?: (...a: unknown[]) => void } }
    w.halo?.realtimeLog?.(...args)
  } catch { /* best-effort */ }
}

export interface UseAudioCaptureOptions {
  /** Called for each PCM chunk (typically ~170ms = 4096 samples = 8192 bytes). */
  onChunk: (pcm: ArrayBuffer) => void
  /** Called ~60fps with the current mic amplitude (0-1). */
  onAmplitude?: (amp: number) => void
}

export interface UseAudioCaptureResult {
  active: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useAudioCapture(options: UseAudioCaptureOptions): UseAudioCaptureResult {
  const { onChunk, onAmplitude } = options
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  // Keep latest callbacks without re-creating the audio graph on each render.
  const onChunkRef = useRef(onChunk)
  const onAmplitudeRef = useRef(onAmplitude)
  useEffect(() => {
    onChunkRef.current = onChunk
    onAmplitudeRef.current = onAmplitude
  })

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try { sourceRef.current?.disconnect() } catch { /* best-effort */ }
    try { analyserRef.current?.disconnect() } catch { /* best-effort */ }
    try { audioCtxRef.current?.close() } catch { /* best-effort */ }
    streamRef.current?.getTracks().forEach((t) => t.stop())

    sourceRef.current = null
    analyserRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    if (active) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_FORMAT.channels,
          sampleRate: { ideal: AUDIO_FORMAT.sampleRate },
          // Echo cancellation and noise suppression can aggressively remove
          // speech-shaped audio and break server-side VAD. Disable them so the
          // raw mic signal reaches the VAD engine unchanged.
          echoCancellation: false,
          noiseSuppression: false,
        },
      })
      const actualRate = stream.getAudioTracks().at(0)?.getSettings().sampleRate ?? null
      console.log('[Realtime] Mic stream acquired, actual sampleRate:', actualRate)
      bridgeLog('Mic stream acquired, actual sampleRate:', actualRate)
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: AUDIO_FORMAT.sampleRate })
      audioCtxRef.current = audioCtx
      console.log('[Realtime] Capture AudioContext created, state:', audioCtx.state, 'contextRate:', audioCtx.sampleRate)
      bridgeLog('Capture AudioContext created, state:', audioCtx.state, 'contextRate:', audioCtx.sampleRate)

      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      // Capture + amplitude analysis via AnalyserNode.
      // ScriptProcessorNode is unreliable when the hardware sample rate (e.g.
      // 48 kHz on this Mac) differs from the AudioContext rate (24 kHz): the
      // processor silently stops firing. The AnalyserNode handles the rate
      // conversion internally, so we read time-domain float data from it
      // in the rAF loop instead.
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.6
      source.connect(analyser)
      analyserRef.current = analyser

      // 512 samples at 24 kHz ≈ 21.3 ms — close to the 20 ms target the
      // StepFun docs recommend for server VAD resolution.
      const floatData = new Float32Array(analyser.frequencyBinCount)
      const byteBuffer = new Uint8Array(analyser.frequencyBinCount)
      let chunkCounter = 0
      let ampLogCounter = 0
      const sampleAmplitude = () => {
        if (!analyserRef.current) return

        // Read time-domain audio and emit as PCM16 chunks.
        analyserRef.current.getFloatTimeDomainData(floatData)
        const pcm = float32ToPcm16(floatData)
        onChunkRef.current(pcm)
        chunkCounter += 1
        if (chunkCounter <= 3 || chunkCounter % 100 === 0) {
          console.log('[Realtime] audio chunk #' + chunkCounter, 'samples=', floatData.length)
          bridgeLog('audio chunk #' + chunkCounter, 'samples=', floatData.length)
        }

        // Amplitude for digital human mouth during 'listening'.
        analyserRef.current.getByteTimeDomainData(byteBuffer)
        let sumSq = 0
        for (let i = 0; i < byteBuffer.length; i++) {
          const v = (byteBuffer[i] - 128) / 128
          sumSq += v * v
        }
        const amp = Math.min(1, Math.sqrt(sumSq / byteBuffer.length) * 2)
        onAmplitudeRef.current?.(amp)

        // Periodic amplitude log (~once per second at 60 fps) so we can see
        // whether the mic is picking up speech while the user is talking.
        ampLogCounter += 1
        if (ampLogCounter % 60 === 0) {
          console.log('[Realtime] mic amplitude:', amp.toFixed(4))
          bridgeLog('mic amplitude:', amp.toFixed(4))
        }

        rafRef.current = requestAnimationFrame(sampleAmplitude)
      }
      rafRef.current = requestAnimationFrame(sampleAmplitude)

      setActive(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }, [active])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return { active, error, start, stop }
}

/** Convert Float32 samples (-1..1) to little-endian 16-bit PCM ArrayBuffer. */
function float32ToPcm16(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]))
    s = s < 0 ? s * 0x8000 : s * 0x7fff
    view.setInt16(i * 2, s, true)
  }
  return buffer
}
