/**
 * TTS 流式播放器 — 基于 Web Audio API 的 PCM 队列播放
 *
 * 设计：
 * - TTS 后端返回 PCM 16bit 单声道音频流（与 STT 输入格式对称）
 * - 本模块负责：PCM → AudioBuffer → 入队 → 顺序播放
 * - 支持暂停/恢复/停止
 * - 播放完毕触发 onEnd 回调（用于 UI 状态切换）
 *
 * 与 STT 的对称关系：
 * - STT：audio in (getUserMedia) → PCM chunks → WebSocket → text out
 * - TTS：text in → HTTP → PCM chunks → AudioBuffer → audio out (speaker)
 */

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended'

interface TTSPlaybackOptions {
  sampleRate: number         // PCM 采样率（StepFun TTS 通常 24000）
  onStateChange?: (state: PlaybackState) => void
  onEnd?: () => void
}

export class TTSPlayback {
  private audioContext: AudioContext | null = null
  private queue: AudioBuffer[] = []
  private nextStartTime = 0
  private activeSources: AudioBufferSourceNode[] = []
  private state: PlaybackState = 'idle'
  private opts: TTSPlaybackOptions
  private endTimer: ReturnType<typeof setTimeout> | null = null
  // 标记上游已无新数据（WebSocket 关闭/音频 done）
  // 避免 chunk 间隙（队列暂时空）被误判为播放结束
  private inputEnded = false

  constructor(opts: TTSPlaybackOptions) {
    this.opts = opts
  }

  private setState(state: PlaybackState) {
    if (this.state === state) return
    this.state = state
    this.opts.onStateChange?.(state)
  }

  /**
   * 初始化 AudioContext（需在用户交互后调用，满足自动播放策略）
   */
  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      this.audioContext = new AudioCtx({ sampleRate: this.opts.sampleRate })
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume()
    }
    return this.audioContext
  }

  /**
   * PCM Int16 → AudioBuffer
   */
  private pcmToAudioBuffer(ctx: AudioContext, pcm: Int16Array): AudioBuffer {
    const buffer = ctx.createBuffer(1, pcm.length, this.opts.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) {
      channel[i] = pcm[i] / 0x8000  // Int16 → Float32 [-1, 1]
    }
    return buffer
  }

  /**
   * 入队一段 PCM 数据（流式调用）
   */
  enqueue(pcm: Int16Array): void {
    if (pcm.length === 0) return
    const ctx = this.ensureContext()
    const audioBuffer = this.pcmToAudioBuffer(ctx, pcm)
    this.queue.push(audioBuffer)
    this.scheduleNext()
  }

  /**
   * 标记上游数据已全部接收完毕（WebSocket 关闭或 tts.response.audio.done）
   * 此后队列真正排空才视为播放结束，避免 chunk 间隙误判
   */
  markInputEnd(): void {
    this.inputEnded = true
    // 如果此时已经没有待播内容，直接结束
    if (this.activeSources.length === 0 && this.queue.length === 0) {
      this.setState('ended')
      this.opts.onEnd?.()
    }
  }

  /**
   * 调度队列中的 buffer 播放
   */
  private scheduleNext(): void {
    if (this.state === 'paused') return
    const ctx = this.audioContext
    if (!ctx) return

    while (this.queue.length > 0) {
      const buffer = this.queue.shift()!
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)

      const now = ctx.currentTime
      const start = Math.max(now, this.nextStartTime)
      source.start(start)
      this.nextStartTime = start + buffer.duration
      this.activeSources.push(source)

      // 最后一段播完后触发 onEnd（仅在 inputEnded 时）
      source.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== source)
        if (this.activeSources.length === 0 && this.queue.length === 0 && this.inputEnded) {
          this.setState('ended')
          this.opts.onEnd?.()
        }
      }
    }

    if (this.state !== 'playing' && this.activeSources.length > 0) {
      this.setState('playing')
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.state !== 'playing') return
    const ctx = this.audioContext
    if (ctx && ctx.state === 'running') {
      void ctx.suspend()
    }
    this.setState('paused')
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (this.state !== 'paused') return
    const ctx = this.audioContext
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume()
    }
    this.setState('playing')
    this.scheduleNext()
  }

  /**
   * 停止并清空所有播放
   */
  stop(): void {
    if (this.endTimer) {
      clearTimeout(this.endTimer)
      this.endTimer = null
    }
    this.activeSources.forEach(s => {
      try { s.stop() } catch {}
      try { s.disconnect() } catch {}
    })
    this.activeSources = []
    this.queue = []
    this.nextStartTime = 0
    this.inputEnded = false
    this.setState('idle')
  }

  /**
   * 释放底层 AudioContext（彻底销毁）
   */
  dispose(): void {
    this.stop()
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {})
    }
    this.audioContext = null
  }
}
