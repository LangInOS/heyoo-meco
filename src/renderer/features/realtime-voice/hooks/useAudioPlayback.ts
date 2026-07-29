// Audio playback hook.
//
// Receives base64 PCM16 chunks from the server and schedules them gap-free
// through Web Audio API AudioBufferSourceNode instances. Each chunk is
// decoded, wrapped in an AudioBuffer, and started at the next available
// time on a shared timeline.
//
// Also runs an amplitude analyzer tap so the caller can drive the digital
// human's mouth during 'speaking'.
//
// Audio graph:  AudioBufferSource -> Analyser -> destination

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_FORMAT } from '../types'

export interface UseAudioPlaybackOptions {
  /** Called when the playback queue transitions between empty and non-empty. */
  onPlayingChange?: (playing: boolean) => void
  /** Called ~60fps with the current playback amplitude (0-1). */
  onAmplitude?: (amp: number) => void
}

export interface UseAudioPlaybackResult {
  /** True while at least one source is still queued or playing. */
  playing: boolean
  /** Enqueue a base64 PCM16 chunk for sequential playback. */
  enqueue: (base64Pcm: string) => void
  /** Cancel all pending playback immediately (used for barge-in). */
  cancel: () => void
  /**
   * Create the AudioContext (if needed) and resume it if suspended.
   * Must be called from a user gesture (e.g. the Speak button click) so the
   * browser's autoplay policy unlocks the context before the first
   * `response.audio.delta` arrives. Idempotent.
   */
  resume: () => void
}

export function useAudioPlayback(options: UseAudioPlaybackOptions): UseAudioPlaybackResult {
  const { onPlayingChange, onAmplitude } = options

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  // Next start time on the shared timeline (seconds). Ensures gap-free playback.
  const nextStartRef = useRef<number>(0)
  // Active sources - used to detect "all done" and to support cancel().
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const rafRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)

  // Keep latest callbacks without re-creating the audio graph.
  const onPlayingChangeRef = useRef(onPlayingChange)
  const onAmplitudeRef = useRef(onAmplitude)
  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange
    onAmplitudeRef.current = onAmplitude
  })

  const ensureContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext({ sampleRate: AUDIO_FORMAT.sampleRate })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.6
      analyser.connect(ctx.destination)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
    }
    return audioCtxRef.current
  }, [])

  const updatePlaying = useCallback((isPlaying: boolean) => {
    setPlaying((prev) => {
      if (prev !== isPlaying) {
        onPlayingChangeRef.current?.(isPlaying)
      }
      return isPlaying
    })
  }, [])

  const stopAmplitudeLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startAmplitudeLoop = useCallback(() => {
    if (rafRef.current != null) return
    const analyser = analyserRef.current
    if (!analyser) return
    const buffer = new Uint8Array(analyser.frequencyBinCount)
    const sample = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(buffer)
      let sumSq = 0
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128
        sumSq += v * v
      }
      const amp = Math.min(1, Math.sqrt(sumSq / buffer.length) * 2)
      onAmplitudeRef.current?.(amp)
      rafRef.current = requestAnimationFrame(sample)
    }
    rafRef.current = requestAnimationFrame(sample)
  }, [])

  const enqueue = useCallback((base64Pcm: string) => {
    const ctx = ensureContext()
    const analyser = analyserRef.current ?? ctx.destination
    const pcm = base64ToArrayBuffer(base64Pcm)
    const sampleCount = pcm.byteLength / 2 // 16-bit samples
    const audioBuf = ctx.createBuffer(1, sampleCount, AUDIO_FORMAT.sampleRate)
    // Decode PCM16 -> Float32 in place.
    const view = new DataView(pcm)
    const channel = audioBuf.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) {
      channel[i] = view.getInt16(i * 2, true) / 0x8000
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuf
    source.connect(analyser)

    const now = ctx.currentTime
    const startAt = Math.max(now, nextStartRef.current)
    source.start(startAt)
    nextStartRef.current = startAt + audioBuf.duration
    sourcesRef.current.push(source)

    updatePlaying(true)
    startAmplitudeLoop()

    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source)
      if (sourcesRef.current.length === 0) {
        updatePlaying(false)
        stopAmplitudeLoop()
      }
    }
  }, [ensureContext, updatePlaying, startAmplitudeLoop, stopAmplitudeLoop])

  const cancel = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try { s.stop() } catch { /* already ended */ }
      try { s.disconnect() } catch { /* best-effort */ }
    })
    sourcesRef.current = []
    nextStartRef.current = 0
    updatePlaying(false)
    stopAmplitudeLoop()
  }, [updatePlaying, stopAmplitudeLoop])

  const resume = useCallback(() => {
    const ctx = ensureContext()
    // AudioContext starts suspended under Chromium's autoplay policy until a
    // user gesture unlocks it. resume() is a no-op when already running.
    if (ctx.state === 'suspended') {
      void ctx.resume().catch((err) => {
        console.warn('[Realtime] Failed to resume playback AudioContext:', err)
      })
    }
  }, [ensureContext])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cancel()
      try { audioCtxRef.current?.close() } catch { /* best-effort */ }
      audioCtxRef.current = null
      analyserRef.current = null
    }
  }, [cancel])

  return { playing, enqueue, cancel, resume }
}

/** Decode a base64 string into an ArrayBuffer. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
